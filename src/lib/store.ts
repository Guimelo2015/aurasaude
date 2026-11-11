"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";
import { buildSeed, DEFAULT_AI_CONFIG, type DataState } from "./seed";
import type {
  AiAgentConfig,
  Appointment,
  AppointmentStatus,
  Budget,
  Campaign,
  Conversation,
  HandoffCard,
  ID,
  Lead,
  LeadStage,
  Message,
  Patient,
  Procedure,
  Queue,
  Segment,
  SegmentFilters,
  Tag,
  Task,
  Transaction,
  TreatmentPlan,
  WaitlistEntry,
  WhatsAppInstance,
} from "./types";
import { CAMPAIGN_COOLDOWN_DAYS, type CampaignRecipient, type PatientStatus } from "./types";
import { uid } from "./utils";
import { toast } from "@/components/ui";
import { CLINIC_SHORT } from "./seed";
import { activePlanPatients, buildPatientIndex, patientStatus, vipThreshold } from "./organize";
import { computeStats, findFreeSlot, NEGATIVE_REPLIES, POSITIVE_REPLIES, REPLY_RATE, renderMessage, resolveAudience } from "./campaigns";
import { format, parseISO } from "date-fns";

/**
 * Store única da aplicação (protótipo).
 * Na fase 2 cada action vira uma chamada ao Supabase (ou server action),
 * mantendo as mesmas assinaturas — as telas não precisam mudar.
 */

interface Session {
  userId?: ID;
}

interface Actions {
  // sessão
  login: (userId: ID) => void;
  logout: () => void;
  resetDemo: () => void;
  ensureSeed: () => void;

  // pacientes
  addPatient: (p: Omit<Patient, "id" | "clinicId" | "createdAt" | "notes" | "tags"> & { tags?: ID[] }) => Patient;
  importPatients: (list: (Omit<Patient, "id" | "clinicId" | "createdAt" | "notes" | "tags">)[]) => number;
  mergePatients: (keepId: ID, removeId: ID) => void;
  setGuardian: (patientId: ID, guardianId?: ID, relation?: string) => void;

  // organização
  setPatientTags: (patientId: ID, tags: ID[]) => void;
  createTag: (name: string, color: string) => Tag;
  saveSegment: (name: string, filters: SegmentFilters) => Segment;
  deleteSegment: (id: ID) => void;
  addPlan: (p: Omit<TreatmentPlan, "id" | "clinicId" | "createdAt" | "status">) => void;
  setPlanStatus: (id: ID, status: TreatmentPlan["status"]) => void;

  // operação
  addTask: (t: Omit<Task, "id" | "clinicId" | "createdAt" | "done">) => void;
  toggleTask: (id: ID) => void;
  deleteTask: (id: ID) => void;
  addToWaitlist: (w: Omit<WaitlistEntry, "id" | "clinicId" | "createdAt">) => void;
  removeFromWaitlist: (id: ID) => void;
  fillSlotFromWaitlist: (cancelledAptId: ID, entryId: ID) => Appointment | undefined;
  sendConfirmations: (aptIds: ID[]) => void;
  updatePatient: (id: ID, patch: Partial<Patient>) => void;
  deletePatient: (id: ID) => void;
  addPatientNote: (id: ID, text: string) => void;

  // funil
  addLead: (l: Omit<Lead, "id" | "clinicId" | "createdAt" | "stageChangedAt">) => Lead;
  moveLead: (id: ID, stage: LeadStage, lostReason?: string) => void;
  updateLead: (id: ID, patch: Partial<Lead>) => void;

  // whatsapp
  sendMessage: (conversationId: ID, text: string, author?: Message["author"], kind?: Message["kind"]) => void;
  addConversation: (c: Omit<Conversation, "id" | "clinicId" | "createdAt">) => Conversation;
  setQueue: (conversationId: ID, queue: Queue) => void;
  assumeConversation: (conversationId: ID) => void;
  transferConversation: (conversationId: ID, target: { userId?: ID; instanceId?: ID }) => void;
  closeConversation: (conversationId: ID) => void;
  reopenConversation: (conversationId: ID) => void;
  handoffConversation: (conversationId: ID, card: HandoffCard) => void;
  linkPatientToConversation: (conversationId: ID, patientId: ID) => void;
  markRead: (conversationId: ID) => void;

  // agenda
  addAppointment: (a: Omit<Appointment, "id" | "clinicId" | "createdAt">) => Appointment;
  setAppointmentStatus: (id: ID, status: AppointmentStatus) => void;
  updateAppointment: (id: ID, patch: Partial<Appointment>) => void;

  // financeiro
  addBudget: (b: Omit<Budget, "id" | "clinicId" | "createdAt">) => Budget;
  setBudgetStatus: (id: ID, status: Budget["status"]) => void;
  addTransaction: (t: Omit<Transaction, "id" | "clinicId">) => void;

  // configurações
  updateAiConfig: (patch: Partial<AiAgentConfig>) => void;
  addInstance: (i: Omit<WhatsAppInstance, "id" | "clinicId">) => void;
  updateInstance: (id: ID, patch: Partial<WhatsAppInstance>) => void;
  removeInstance: (id: ID) => void;
  upsertProcedure: (p: Omit<Procedure, "clinicId"> & { id?: ID }) => void;
  removeProcedure: (id: ID) => void;
  toggleUser: (id: ID) => void;

  // campanhas
  addCampaign: (c: Omit<Campaign, "id" | "clinicId" | "createdAt" | "updatedAt" | "stats">) => Campaign;
  updateCampaign: (id: ID, patch: Partial<Campaign>) => void;
  deleteCampaign: (id: ID) => void;
  launchCampaign: (id: ID) => void; // rascunho/agendada/pausada → "enviando" → "concluida"
  runDueCampaigns: () => void; // dispara agendadas vencidas e retoma envios interrompidos
  pauseCampaign: (id: ID) => void;
  cancelCampaign: (id: ID) => void;
}

export type AppState = DataState & { session: Session; seeded: boolean } & Actions;

const EMPTY: DataState = {
  clinic: { id: "", name: "" },
  users: [],
  professionals: [],
  procedures: [],
  instances: [],
  patients: [],
  leads: [],
  conversations: [],
  messages: [],
  appointments: [],
  budgets: [],
  transactions: [],
  aiConfig: DEFAULT_AI_CONFIG,
  tags: [],
  segments: [],
  plans: [],
  tasks: [],
  waitlist: [],
  campaigns: [],
};

const now = () => new Date().toISOString();

/** localStorage tolerante a falhas (modo privado, cota excedida): o app segue em memória. */
let warned = false;
const safeLocalStorage = {
  getItem: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      if (!warned) console.warn("[Aura] Não foi possível salvar no navegador; os dados ficarão apenas nesta sessão.", e);
      warned = true;
    }
  },
  removeItem: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => {
      const currentUser = () => get().users.find((u) => u.id === get().session.userId);
      const sysMsg = (conversationId: ID, text: string): Message => ({
        id: uid("msg"),
        conversationId,
        author: "sistema",
        text,
        createdAt: now(),
      });
      const patchConv = (id: ID, patch: Partial<Conversation>) =>
        set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      const patchLead = (id: ID, patch: Partial<Lead>) =>
        set((s) => ({ leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

      return {
        ...EMPTY,
        session: {},
        seeded: false,

        // ---------------- sessão ----------------
        login: (userId) => set({ session: { userId } }),
        logout: () => set({ session: {} }),
        resetDemo: () => set((s) => ({ ...buildSeed(), seeded: true, session: s.session })),
        ensureSeed: () => {
          if (!get().seeded) set({ ...buildSeed(), seeded: true });
        },

        // ---------------- pacientes ----------------
        addPatient: (p) => {
          const patient: Patient = { ...p, tags: p.tags ?? [], id: uid("pac"), clinicId: get().clinic.id, createdAt: now(), notes: [] };
          set((s) => ({ patients: [patient, ...s.patients] }));
          return patient;
        },
        importPatients: (list) => {
          const created = list.map((p) => ({ ...p, id: uid("pac"), clinicId: get().clinic.id, createdAt: now(), notes: [], tags: [] }) as Patient);
          set((s) => ({ patients: [...created, ...s.patients] }));
          return created.length;
        },
        mergePatients: (keepId, removeId) =>
          set((s) => {
            const keep = s.patients.find((p) => p.id === keepId);
            const rem = s.patients.find((p) => p.id === removeId);
            if (!keep || !rem) return {};
            const swap = <T extends { patientId?: ID }>(arr: T[]) => arr.map((x) => (x.patientId === removeId ? { ...x, patientId: keepId } : x));
            const merged: Patient = {
              ...keep,
              notes: [...keep.notes, ...rem.notes, { id: uid("note"), text: `Cadastro unificado com "${rem.name}" (CPF ${rem.cpf}).`, authorName: currentUser()?.name ?? "Sistema", createdAt: now() }],
              tags: [...new Set([...keep.tags, ...rem.tags])],
            };
            return {
              patients: s.patients.filter((p) => p.id !== removeId).map((p) => (p.id === keepId ? merged : p.guardianId === removeId ? { ...p, guardianId: keepId } : p)),
              appointments: swap(s.appointments),
              conversations: swap(s.conversations),
              leads: swap(s.leads),
              budgets: swap(s.budgets),
              transactions: swap(s.transactions),
              plans: swap(s.plans),
              tasks: swap(s.tasks),
              waitlist: swap(s.waitlist),
            };
          }),
        setGuardian: (patientId, guardianId, relation) =>
          set((s) => ({ patients: s.patients.map((p) => (p.id === patientId ? { ...p, guardianId, guardianRelation: guardianId ? relation : undefined } : p)) })),

        // ---------------- organização ----------------
        setPatientTags: (patientId, tags) => set((s) => ({ patients: s.patients.map((p) => (p.id === patientId ? { ...p, tags } : p)) })),
        createTag: (name, color) => {
          const tag: Tag = { id: uid("tag"), name, color };
          set((s) => ({ tags: [...s.tags, tag] }));
          return tag;
        },
        saveSegment: (name, filters) => {
          const seg: Segment = { id: uid("seg"), name, filters };
          set((s) => ({ segments: [...s.segments, seg] }));
          return seg;
        },
        deleteSegment: (id) => set((s) => ({ segments: s.segments.filter((x) => x.id !== id) })),
        addPlan: (p) => set((s) => ({ plans: [...s.plans, { ...p, id: uid("plan"), clinicId: s.clinic.id, createdAt: now(), status: "ativo" }] })),
        setPlanStatus: (id, status) => set((s) => ({ plans: s.plans.map((p) => (p.id === id ? { ...p, status } : p)) })),

        // ---------------- operação ----------------
        addTask: (t) => set((s) => ({ tasks: [...s.tasks, { ...t, id: uid("task"), clinicId: s.clinic.id, createdAt: now(), done: false }] })),
        toggleTask: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
        deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
        addToWaitlist: (w) => set((s) => ({ waitlist: [...s.waitlist, { ...w, id: uid("wait"), clinicId: s.clinic.id, createdAt: now() }] })),
        removeFromWaitlist: (id) => set((s) => ({ waitlist: s.waitlist.filter((w) => w.id !== id) })),
        fillSlotFromWaitlist: (cancelledAptId, entryId) => {
          const s = get();
          const slot = s.appointments.find((a) => a.id === cancelledAptId);
          const entry = s.waitlist.find((w) => w.id === entryId);
          if (!slot || !entry) return undefined;
          const proc = s.procedures.find((p) => p.id === entry.procedureId);
          const apt = s.addAppointment({
            patientId: entry.patientId, professionalId: slot.professionalId, procedureId: entry.procedureId, start: slot.start,
            durationMin: Math.min(proc?.durationMin ?? slot.durationMin, slot.durationMin), status: "confirmado", confirmation: "confirmou",
            value: proc?.price ?? slot.value, modality: slot.modality ?? "presencial", notes: "Encaixe da lista de espera",
          });
          // marca o horário cancelado como reaproveitado
          set((st) => ({
            waitlist: st.waitlist.filter((w) => w.id !== entryId),
            appointments: st.appointments.map((a) => (a.id === cancelledAptId ? { ...a, notes: `${a.notes ? a.notes + " · " : ""}Horário reaproveitado (lista de espera)` } : a)),
          }));
          return apt;
        },
        sendConfirmations: (aptIds) => {
          set((s) => ({ appointments: s.appointments.map((a) => (aptIds.includes(a.id) ? { ...a, confirmation: "enviada" } : a)) }));
          // simulação: as respostas chegam pelo WhatsApp nos segundos seguintes
          aptIds.forEach((id, i) => {
            setTimeout(() => {
              const r = Math.random();
              const answer = r < 0.72 ? "confirmou" : r < 0.86 ? "sem_resposta" : "cancelou";
              set((s) => ({
                appointments: s.appointments.map((a) =>
                  a.id === id
                    ? { ...a, confirmation: answer, status: answer === "confirmou" ? "confirmado" : answer === "cancelou" ? "cancelado" : a.status }
                    : a,
                ),
              }));
            }, 900 + i * 450 + Math.random() * 600);
          });
        },
        updatePatient: (id, patch) =>
          set((s) => ({ patients: s.patients.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
        deletePatient: (id) =>
          set((s) => ({
            patients: s.patients.filter((p) => p.id !== id),
            appointments: s.appointments.filter((a) => a.patientId !== id),
            plans: s.plans.filter((p) => p.patientId !== id),
            waitlist: s.waitlist.filter((w) => w.patientId !== id),
            tasks: s.tasks.map((t) => (t.patientId === id ? { ...t, patientId: undefined } : t)),
            conversations: s.conversations.map((c) => (c.patientId === id ? { ...c, patientId: undefined } : c)),
            leads: s.leads.map((l) => (l.patientId === id ? { ...l, patientId: undefined } : l)),
          })),
        addPatientNote: (id, text) => {
          const author = currentUser()?.name ?? "Sistema";
          set((s) => ({
            patients: s.patients.map((p) =>
              p.id === id ? { ...p, notes: [{ id: uid("note"), text, authorName: author, createdAt: now() }, ...p.notes] } : p,
            ),
          }));
        },

        // ---------------- funil ----------------
        addLead: (l) => {
          const lead: Lead = { ...l, id: uid("lead"), clinicId: get().clinic.id, createdAt: now(), stageChangedAt: now() };
          set((s) => ({ leads: [lead, ...s.leads] }));
          return lead;
        },
        moveLead: (id, stage, lostReason) =>
          patchLead(id, { stage, stageChangedAt: now(), lostReason: stage === "perdido" ? lostReason ?? "Sem resposta" : undefined }),
        updateLead: (id, patch) => patchLead(id, patch),

        // ---------------- whatsapp ----------------
        sendMessage: (conversationId, text, author = "atendente", kind = "texto") => {
          const user = currentUser();
          const conv = get().conversations.find((c) => c.id === conversationId);
          if (!conv) return;
          const msg: Message = {
            id: uid("msg"),
            conversationId,
            author,
            text,
            kind,
            createdAt: now(),
            authorName: author === "atendente" ? user?.name : author === "ia" ? `${get().aiConfig.name} (IA)` : undefined,
          };
          const extra: Message[] = [];
          const patch: Partial<Conversation> = { lastMessageAt: msg.createdAt };
          if (author === "atendente") {
            // atendente escreveu: IA sai de cena e o ticket entra em atendimento
            if (conv.handler === "ia" || conv.queue === "novo" || conv.queue === "ia") {
              patch.handler = "humano";
              patch.queue = "em_atendimento";
              patch.assignedUserId = user?.id;
              extra.push(sysMsg(conversationId, `${user?.name ?? "Atendente"} assumiu o atendimento`));
            }
            if (conv.queue === "finalizado") patch.queue = "em_atendimento";
          }
          if (author === "contato") {
            patch.unread = conv.unread + 1;
            if (conv.queue === "aguardando") patch.queue = "em_atendimento";
          }
          set((s) => ({ messages: [...s.messages, ...extra, msg] }));
          patchConv(conversationId, patch);
        },
        addConversation: (c) => {
          const conv: Conversation = { ...c, id: uid("conv"), clinicId: get().clinic.id, createdAt: now() };
          set((s) => ({ conversations: [conv, ...s.conversations] }));
          return conv;
        },
        setQueue: (conversationId, queue) => patchConv(conversationId, { queue }),
        assumeConversation: (conversationId) => {
          const user = currentUser();
          set((s) => ({ messages: [...s.messages, sysMsg(conversationId, `${user?.name ?? "Atendente"} assumiu o atendimento`)] }));
          patchConv(conversationId, { handler: "humano", queue: "em_atendimento", assignedUserId: user?.id, unread: 0 });
        },
        transferConversation: (conversationId, { userId, instanceId }) => {
          const s = get();
          const target = s.users.find((u) => u.id === userId);
          const inst = s.instances.find((i) => i.id === instanceId);
          const conv = s.conversations.find((c) => c.id === conversationId);
          const label = target ? target.name : inst ? `fila ${inst.department}` : "fila";
          set((st) => ({
            messages: [...st.messages, sysMsg(conversationId, `${currentUser()?.name ?? "Atendente"} transferiu o atendimento para ${label}`)],
          }));
          patchConv(conversationId, {
            assignedUserId: userId,
            instanceId: inst?.id ?? conv?.instanceId,
            department: inst?.department ?? conv?.department,
            handler: "humano",
            queue: userId ? "em_atendimento" : "novo",
          });
        },
        closeConversation: (conversationId) => {
          set((s) => ({
            messages: [...s.messages, sysMsg(conversationId, `Atendimento encerrado por ${currentUser()?.name ?? "Atendente"}`)],
          }));
          patchConv(conversationId, { queue: "finalizado", closedAt: now(), unread: 0 });
        },
        reopenConversation: (conversationId) => {
          set((s) => ({ messages: [...s.messages, sysMsg(conversationId, `Atendimento reaberto por ${currentUser()?.name ?? "Atendente"}`)] }));
          patchConv(conversationId, { queue: "em_atendimento", handler: "humano", assignedUserId: currentUser()?.id, closedAt: undefined });
        },
        handoffConversation: (conversationId, card) => {
          const conv = get().conversations.find((c) => c.id === conversationId);
          set((s) => ({
            messages: [
              ...s.messages,
              sysMsg(
                conversationId,
                `${card.urgency === "alta" ? "Prioridade ALTA • " : ""}${s.aiConfig.name} (IA) concluiu a triagem e transferiu para a fila Novos Atendimentos`,
              ),
            ],
          }));
          patchConv(conversationId, { handoff: card, handler: "humano", queue: "novo" });
          if (conv?.leadId) {
            const proc = get().procedures.find((p) => p.id === card.procedureId);
            patchLead(conv.leadId, {
              stage: "qualificacao",
              stageChangedAt: now(),
              interest: card.interest,
              estimatedValue: proc?.price ?? 0,
            });
          }
        },
        linkPatientToConversation: (conversationId, patientId) => {
          const conv = get().conversations.find((c) => c.id === conversationId);
          const p = get().patients.find((x) => x.id === patientId);
          patchConv(conversationId, { patientId, contactName: p?.name ?? conv?.contactName ?? "" });
          if (conv?.leadId) patchLead(conv.leadId, { patientId, name: p?.name ?? "" });
          set((s) => ({ messages: [...s.messages, sysMsg(conversationId, `Conversa vinculada ao cadastro de ${p?.name}`)] }));
        },
        markRead: (conversationId) => patchConv(conversationId, { unread: 0 }),

        // ---------------- agenda ----------------
        addAppointment: (a) => {
          const apt: Appointment = { ...a, id: uid("apt"), clinicId: get().clinic.id, createdAt: now() };
          set((s) => ({ appointments: [...s.appointments, apt] }));
          // automação: lead vinculado avança para "Agendado"
          const lead =
            (a.leadId && get().leads.find((l) => l.id === a.leadId)) ||
            get().leads.find((l) => l.patientId === a.patientId && !["realizado", "perdido"].includes(l.stage));
          if (lead) patchLead(lead.id, { stage: "agendado", stageChangedAt: now(), appointmentId: apt.id, patientId: a.patientId });
          return apt;
        },
        setAppointmentStatus: (id, status) => {
          const apt = get().appointments.find((a) => a.id === id);
          if (!apt) return;
          set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, status } : a)) }));
          // automação: comparecimento gera receita e conclui o lead
          if (status === "compareceu" && apt.status !== "compareceu") {
            const proc = get().procedures.find((p) => p.id === apt.procedureId);
            const pat = get().patients.find((p) => p.id === apt.patientId);
            get().addTransaction({
              type: "entrada",
              category: proc?.category ?? "Consulta",
              description: `${proc?.name} — ${pat?.name}`,
              amount: apt.value,
              date: now(),
              method: "Pix",
              patientId: apt.patientId,
              appointmentId: apt.id,
            });
            const lead = get().leads.find((l) => l.appointmentId === id);
            if (lead) patchLead(lead.id, { stage: "realizado", stageChangedAt: now() });
          }
          if (apt.status === "compareceu" && status !== "compareceu") {
            set((s) => ({ transactions: s.transactions.filter((t) => t.appointmentId !== id) }));
          }
        },
        updateAppointment: (id, patch) =>
          set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

        // ---------------- financeiro ----------------
        addBudget: (b) => {
          const budget: Budget = { ...b, id: uid("orc"), clinicId: get().clinic.id, createdAt: now() };
          set((s) => ({ budgets: [budget, ...s.budgets] }));
          if (b.leadId) patchLead(b.leadId, { stage: "orcamento", stageChangedAt: now(), budgetId: budget.id, estimatedValue: b.total });
          return budget;
        },
        setBudgetStatus: (id, status) =>
          set((s) => ({ budgets: s.budgets.map((b) => (b.id === id ? { ...b, status } : b)) })),
        addTransaction: (t) =>
          set((s) => ({ transactions: [...s.transactions, { ...t, id: uid("trx"), clinicId: s.clinic.id }] })),

        // ---------------- configurações ----------------
        updateAiConfig: (patch) => set((s) => ({ aiConfig: { ...s.aiConfig, ...patch } })),
        addInstance: (i) =>
          set((s) => ({ instances: [...s.instances, { ...i, id: uid("wa"), clinicId: s.clinic.id }] })),
        updateInstance: (id, patch) =>
          set((s) => ({ instances: s.instances.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
        removeInstance: (id) => set((s) => ({ instances: s.instances.filter((i) => i.id !== id) })),
        upsertProcedure: (p) =>
          set((s) => {
            if (p.id && s.procedures.some((x) => x.id === p.id)) {
              return { procedures: s.procedures.map((x) => (x.id === p.id ? { ...x, ...p, id: x.id } : x)) };
            }
            return { procedures: [...s.procedures, { ...p, id: uid("proc"), clinicId: s.clinic.id }] };
          }),
        removeProcedure: (id) => set((s) => ({ procedures: s.procedures.filter((p) => p.id !== id) })),
        toggleUser: (id) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, active: !u.active } : u)) })),

        // ---------------- campanhas ----------------
        addCampaign: (c) => {
          const camp: Campaign = {
            ...c,
            id: uid("camp"),
            clinicId: get().clinic.id,
            createdAt: now(),
            updatedAt: now(),
          };
          set((s) => ({ campaigns: [camp, ...s.campaigns] }));
          return camp;
        },
        updateCampaign: (id, patch) =>
          set((s) => ({
            campaigns: s.campaigns.map((c) =>
              c.id === id ? { ...c, ...patch, updatedAt: now() } : c
            ),
          })),
        deleteCampaign: (id) => {
          stopSending(id);
          set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) }));
        },
        launchCampaign: (id) => {
          const camp = get().campaigns.find((c) => c.id === id);
          if (!camp || ["concluida", "cancelada", "enviando"].includes(camp.status)) {
            if (camp?.status === "enviando") startSending(id);
            return;
          }
          // resolve o público só no primeiro lançamento (retomar mantém a lista)
          let recipients = camp.recipients;
          if (!recipients?.length) {
            const s = get();
            const { recipients: list, excluded } = resolveAudience(camp, { ...s, status: statusMap(s) });
            recipients = list;
            const skipped = excluded.optOut + excluded.cooldown + excluded.duplicate + excluded.inConversation;
            if (!list.length) {
              toast("Nenhum contato elegível para esta campanha (todos excluídos pelas regras de proteção)", "danger");
              return;
            }
            if (skipped) toast(`${list.length} contatos na fila · ${skipped} excluídos (descadastro, carência de ${CAMPAIGN_COOLDOWN_DAYS} dias ou duplicados)`, "info");
          }
          set((s) => ({
            campaigns: s.campaigns.map((c) =>
              c.id === id ? { ...c, status: "enviando", recipients, sentAt: c.sentAt ?? now(), updatedAt: now(), stats: computeStats({ ...c, recipients }, s.appointments, s.leads) } : c,
            ),
          }));
          startSending(id);
          toast("🚀 Campanha em envio. Os resultados aparecem em tempo real.");
        },
        runDueCampaigns: () => {
          const nowIso = now();
          for (const c of get().campaigns) {
            if (c.status === "agendada" && c.scheduledAt && c.scheduledAt <= nowIso) get().launchCampaign(c.id);
            else if (c.status === "enviando" && !timers.has(c.id)) startSending(c.id); // retoma após recarregar a página
          }
        },
        pauseCampaign: (id) => {
          stopSending(id);
          set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status: "pausada", updatedAt: now() } : c)) }));
        },
        cancelCampaign: (id) => {
          stopSending(id);
          set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status: "cancelada", updatedAt: now() } : c)) }));
        },
      };
    },
    {
      name: "aura-saude-demo",
      // v4: campanhas com destinatários reais e atribuição. Versões antigas são regeradas.
      version: 4,
      migrate: (persisted, version) => (version < 4 ? ({ session: {}, seeded: false } as unknown as AppState) : (persisted as AppState)),
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { login, logout, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== "function")) as Partial<AppState>;
      },
    },
  ),
);

// =====================================================================
// Envio de campanhas (simulação). Em produção: fila no servidor que envia
// em lotes pela Evolution API e recebe as respostas pelo webhook.
// =====================================================================
const timers = new Map<ID, ReturnType<typeof setInterval>>();
const BATCH_SIZE = 6;
const BATCH_INTERVAL_MS = 800;
const pickOne = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function statusMap(s: AppState) {
  const idx = buildPatientIndex(s.appointments, s.procedures);
  const vip = vipThreshold(idx);
  const inPlan = activePlanPatients(s.plans, s.appointments, s.procedures);
  return Object.fromEntries(s.patients.map((p) => [p.id, patientStatus(p, idx[p.id], inPlan, vip)])) as Record<ID, PatientStatus>;
}

function stopSending(id: ID) {
  const t = timers.get(id);
  if (t) clearInterval(t);
  timers.delete(id);
}

function startSending(id: ID) {
  if (timers.has(id) || typeof window === "undefined") return;
  timers.set(id, setInterval(() => sendBatch(id), BATCH_INTERVAL_MS));
}

function sendBatch(id: ID) {
  const st = useApp.getState();
  const camp = st.campaigns.find((c) => c.id === id);
  if (!camp || camp.status !== "enviando") return stopSending(id);
  const recips = [...(camp.recipients ?? [])];
  const batch = recips.map((r, i) => (r.status === "pendente" ? i : -1)).filter((i) => i >= 0).slice(0, BATCH_SIZE);

  if (!batch.length) {
    stopSending(id);
    useApp.setState((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status: "concluida", updatedAt: now(), stats: computeStats(c, s.appointments, s.leads) } : c)),
    }));
    const replied = recips.filter((r) => r.status === "respondeu").length;
    toast(`Campanha "${camp.name}" concluída · ${replied} respostas no Atendimento`);
    return;
  }

  const sentAt = now();
  for (const i of batch) {
    const r = { ...recips[i], sentAt };
    if (Math.random() < 0.07) r.status = "falhou"; // número inválido / sem WhatsApp
    else if (Math.random() < REPLY_RATE[camp.audience]) {
      const x = Math.random();
      if (x < 0.1) {
        r.status = "optout";
        r.reply = "SAIR";
      } else {
        r.status = "respondeu";
        r.reply = x < 0.7 ? pickOne(POSITIVE_REPLIES) : pickOne(NEGATIVE_REPLIES);
      }
      r.conversationId = handleReply(camp, r);
    } else r.status = "entregue";
    recips[i] = r;
  }
  useApp.setState((s) => ({
    campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, recipients: recips, updatedAt: now(), stats: computeStats({ ...c, recipients: recips }, s.appointments, s.leads) } : c)),
  }));
}

/** Efeitos de uma resposta: descadastro, conversa no Atendimento, lead perdido de volta ao funil, auto-agendamento. */
function handleReply(camp: Campaign, r: CampaignRecipient): ID | undefined {
  const st = useApp.getState();
  if (r.status === "optout") {
    useApp.setState((s) => ({
      patients: s.patients.map((p) => (p.phone === r.phone ? { ...p, optOut: true } : p)),
      leads: s.leads.map((l) => (l.phone === r.phone ? { ...l, optOut: true } : l)),
    }));
    return undefined;
  }
  const positive = POSITIVE_REPLIES.includes(r.reply ?? "");
  if (!positive) return undefined; // "agora não": registrado na campanha, sem abrir atendimento

  const lead = r.kind === "lead" ? st.leads.find((l) => l.id === r.targetId) : undefined;
  const patient = st.patients.find((p) => p.id === (r.patientId ?? lead?.patientId));
  const lastConsult = patient && buildPatientIndex(st.appointments.filter((a) => a.patientId === patient.id), st.procedures)[patient.id]?.lastVisit;
  const text = renderMessage(camp.messages[0]?.text ?? "", {
    nome: r.name,
    clinica: CLINIC_SHORT,
    data: lastConsult ? format(parseISO(lastConsult), "dd/MM/yyyy") : lead ? format(parseISO(lead.createdAt), "dd/MM/yyyy") : "",
  });

  // reaproveita conversa aberta com o mesmo telefone
  let conv = st.conversations.find((c) => c.phone === r.phone && c.queue !== "finalizado");
  const t = now();
  if (!conv) {
    const inst = st.instances[0];
    conv = st.addConversation({
      instanceId: inst.id, department: inst.department, contactName: r.name, phone: r.phone, patientId: patient?.id, leadId: lead?.id,
      queue: "novo", handler: "humano", unread: 1, lastMessageAt: t, campaignId: camp.id,
    });
  } else {
    st.setQueue(conv.id, conv.queue === "aguardando" ? "em_atendimento" : conv.queue);
  }
  const convId = conv.id;
  useApp.setState((s) => ({
    messages: [
      ...s.messages,
      { id: uid("msg"), conversationId: convId, author: "atendente", authorName: `Campanha · ${camp.name}`, text, createdAt: t },
      { id: uid("msg"), conversationId: convId, author: "contato", text: r.reply ?? "", createdAt: t },
      { id: uid("msg"), conversationId: convId, author: "sistema", text: `Resposta à campanha "${camp.name}" — contato enviado para a fila Novos`, createdAt: t },
    ],
    conversations: s.conversations.map((c) => (c.id === convId ? { ...c, lastMessageAt: t, unread: c.unread + 1 } : c)),
    // lead perdido que respondeu volta para o funil
    leads: s.leads.map((l) =>
      lead && l.id === lead.id && l.stage === "perdido"
        ? { ...l, stage: "qualificacao", lostReason: undefined, stageChangedAt: t, recoveredByCampaignId: camp.id, conversationId: l.conversationId ?? convId }
        : l,
    ),
  }));

  // simulação: parte dos PACIENTES (já têm cadastro) escolhe um horário pelo link de agendamento
  if (patient && Math.random() < 0.45) {
    setTimeout(() => {
      const s = useApp.getState();
      const last = s.appointments.filter((a) => a.patientId === patient.id && a.status === "compareceu").sort((a, b) => b.start.localeCompare(a.start))[0];
      const procedure = s.procedures.find((p) => p.id === (last?.procedureId ?? "proc_retorno")) ?? s.procedures[0];
      const profId = last?.professionalId ?? s.professionals[0].id;
      const slot = findFreeSlot(s.appointments, profId, procedure.durationMin);
      if (!slot) return;
      s.addAppointment({
        patientId: patient.id, professionalId: profId, procedureId: procedure.id, start: slot.toISOString(), durationMin: procedure.durationMin,
        status: "agendado", value: last?.value ?? procedure.price, modality: last?.modality ?? "presencial", notes: `Agendado pelo link da campanha "${camp.name}"`,
      });
      useApp.setState((x) => ({
        messages: [...x.messages, { id: uid("msg"), conversationId: convId, author: "sistema", text: `📅 ${r.name.split(" ")[0]} escolheu um horário pelo link: ${format(slot, "dd/MM 'às' HH:mm")} (${procedure.name})`, createdAt: now() }],
      }));
    }, 2500 + Math.random() * 2500);
  }
  return convId;
}

/** true depois que o estado foi carregado do navegador (evita mismatch de SSR). */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const done = () => {
      useApp.getState().ensureSeed();
      setHydrated(true);
    };
    if (useApp.persist.hasHydrated()) done();
    const unsub = useApp.persist.onFinishHydration(done);
    return unsub;
  }, []);
  return hydrated;
}

export function useCurrentUser() {
  return useApp((s) => s.users.find((u) => u.id === s.session.userId));
}
