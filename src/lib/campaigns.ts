import { addDays, addMinutes, differenceInDays, format, parseISO, setHours, setMinutes, startOfDay, subDays } from "date-fns";
import type {
  Appointment,
  Campaign,
  CampaignAudience,
  CampaignRecipient,
  Conversation,
  ID,
  Lead,
  Patient,
  PatientStatus,
  Segment,
} from "./types";
import { CAMPAIGN_ATTRIBUTION_DAYS, CAMPAIGN_COOLDOWN_DAYS } from "./types";
import { matchesFilters } from "./organize";

/**
 * Regras do módulo de Campanhas (funções puras).
 * Documentação completa: docs/modulos/06-campanhas.md
 */

export const AUDIENCE_LABEL: Record<CampaignAudience, string> = {
  todos_leads_perdidos: "Todos os leads perdidos",
  leads_sem_resposta: "Leads sem resposta (+3 dias)",
  pacientes_inativos: "Pacientes inativos (+60 dias)",
  segmento_personalizado: "Segmento personalizado",
  lista_manual: "Lista manual",
};

export const AUDIENCE_RULE: Record<CampaignAudience, string> = {
  todos_leads_perdidos: "Leads na etapa 'Perdido / Sem resposta' do funil.",
  leads_sem_resposta: "Leads em Novo, Qualificação ou Orçamento sem nenhuma movimentação há 3 dias ou mais (exceto quem está em atendimento agora).",
  pacientes_inativos: "Pacientes com status 'Em risco' ou 'Inativo': última consulta há mais de 60 dias e nada agendado.",
  segmento_personalizado: "Pacientes que atendem aos filtros do segmento salvo em Pacientes.",
  lista_manual: "Contatos escolhidos a dedo (ex.: vindos do Funil, Relatórios ou de um filtro de Pacientes).",
};

/** Probabilidade simulada de resposta por público (calibrada para WhatsApp em saúde). */
export const REPLY_RATE: Record<CampaignAudience, number> = {
  todos_leads_perdidos: 0.16,
  leads_sem_resposta: 0.28,
  pacientes_inativos: 0.22,
  segmento_personalizado: 0.24,
  lista_manual: 0.2,
};

/** Motivos de perda que valem uma nova tentativa (os demais indicam desinteresse real). */
export const RECOVERABLE_REASONS = ["Achou caro / não aceita o convênio", "Sem horário compatível", "Sem resposta após orçamento"];
export const RECOVERABLE_WINDOW_DAYS = 90;

export function isRecoverable(l: Lead, now = new Date()) {
  return (
    l.stage === "perdido" &&
    !l.optOut &&
    !!l.lostReason &&
    RECOVERABLE_REASONS.includes(l.lostReason) &&
    differenceInDays(now, parseISO(l.stageChangedAt)) <= RECOVERABLE_WINDOW_DAYS
  );
}

interface AudienceCtx {
  patients: Patient[];
  leads: Lead[];
  conversations: Conversation[];
  campaigns: Campaign[];
  segments: Segment[];
  status: Record<ID, PatientStatus>;
  now?: Date;
}

export interface AudienceResult {
  recipients: CampaignRecipient[];
  excluded: { optOut: number; cooldown: number; duplicate: number; inConversation: number };
}

/** Resolve quem recebe a campanha, aplicando as proteções (descadastro, carência, duplicidade). */
export function resolveAudience(c: Pick<Campaign, "id" | "audience" | "segmentId" | "manualTargets">, ctx: AudienceCtx): AudienceResult {
  const now = ctx.now ?? new Date();
  const excluded = { optOut: 0, cooldown: 0, duplicate: 0, inConversation: 0 };
  const byId = new Map(ctx.patients.map((p) => [p.id, p]));
  const activeConvPhones = new Set(ctx.conversations.filter((cv) => cv.queue === "em_atendimento").map((cv) => cv.phone));

  const fromPatient = (p: Patient): CampaignRecipient => {
    // menor de idade: a mensagem vai para o responsável (o telefone é dele)
    const guardian = p.guardianId ? byId.get(p.guardianId) : undefined;
    return { kind: "patient", targetId: p.id, patientId: p.id, name: guardian?.name ?? p.name, phone: p.phone, status: "pendente" };
  };
  const fromLead = (l: Lead): CampaignRecipient => ({ kind: "lead", targetId: l.id, patientId: l.patientId, name: l.name, phone: l.phone, status: "pendente" });

  let candidates: { r: CampaignRecipient; optOut?: boolean }[] = [];
  switch (c.audience) {
    case "todos_leads_perdidos":
      candidates = ctx.leads.filter((l) => l.stage === "perdido").map((l) => ({ r: fromLead(l), optOut: l.optOut }));
      break;
    case "leads_sem_resposta":
      candidates = ctx.leads
        .filter((l) => ["novo", "qualificacao", "orcamento"].includes(l.stage) && differenceInDays(now, parseISO(l.stageChangedAt)) >= 3)
        .filter((l) => {
          if (activeConvPhones.has(l.phone)) {
            excluded.inConversation++;
            return false;
          }
          return true;
        })
        .map((l) => ({ r: fromLead(l), optOut: l.optOut }));
      break;
    case "pacientes_inativos":
      candidates = ctx.patients.filter((p) => ["em_risco", "inativo"].includes(ctx.status[p.id])).map((p) => ({ r: fromPatient(p), optOut: p.optOut }));
      break;
    case "segmento_personalizado": {
      const seg = ctx.segments.find((s) => s.id === c.segmentId);
      candidates = seg ? ctx.patients.filter((p) => matchesFilters(p, ctx.status[p.id], seg.filters)).map((p) => ({ r: fromPatient(p), optOut: p.optOut })) : [];
      break;
    }
    case "lista_manual": {
      const leadsById = new Map(ctx.leads.map((l) => [l.id, l]));
      candidates = (c.manualTargets ?? [])
        .map((id) => {
          const p = byId.get(id);
          if (p) return { r: fromPatient(p), optOut: p.optOut };
          const l = leadsById.get(id);
          return l ? { r: fromLead(l), optOut: l.optOut } : null;
        })
        .filter(Boolean) as typeof candidates;
      break;
    }
  }

  // telefones que receberam outra campanha nos últimos N dias
  const cooldownSince = subDays(now, CAMPAIGN_COOLDOWN_DAYS).toISOString();
  const recent = new Set<string>();
  for (const other of ctx.campaigns) {
    if (other.id === c.id) continue;
    for (const r of other.recipients ?? []) if (r.sentAt && r.sentAt >= cooldownSince) recent.add(r.phone);
  }

  const seen = new Set<string>();
  const recipients: CampaignRecipient[] = [];
  for (const { r, optOut } of candidates) {
    if (optOut) { excluded.optOut++; continue; }
    if (seen.has(r.phone)) { excluded.duplicate++; continue; }
    if (recent.has(r.phone)) { excluded.cooldown++; continue; }
    seen.add(r.phone);
    recipients.push(r);
  }
  return { recipients, excluded };
}

/** Variáveis: {{nome}} primeiro nome · {{clinica}} · {{data}} última consulta (paciente) ou 1º contato (lead). */
export function renderMessage(text: string, vars: { nome: string; clinica: string; data?: string }) {
  return text
    .replace(/\{\{\s*nome\s*\}\}/g, vars.nome.split(" ")[0])
    .replace(/\{\{\s*clinica\s*\}\}/g, vars.clinica)
    .replace(/\{\{\s*data\s*\}\}/g, vars.data ?? "");
}

/** Agendamentos atribuídos a uma campanha: criados até N dias após o envio para aquele contato. */
export function attributedAppointments(c: Campaign, appointments: Appointment[], leads: Lead[]) {
  const leadPatient = new Map(leads.map((l) => [l.id, l.patientId]));
  const out: Appointment[] = [];
  for (const r of c.recipients ?? []) {
    if (!r.sentAt || r.status === "falhou" || r.status === "optout") continue;
    const pid = r.patientId ?? (r.kind === "lead" ? leadPatient.get(r.targetId) : undefined);
    if (!pid) continue;
    const until = addDays(parseISO(r.sentAt), CAMPAIGN_ATTRIBUTION_DAYS).toISOString();
    const apt = appointments
      .filter((a) => a.patientId === pid && a.createdAt >= r.sentAt! && a.createdAt <= until && a.status !== "cancelado")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (apt) out.push(apt);
  }
  return out;
}

export function computeStats(c: Campaign, appointments: Appointment[], leads: Lead[]) {
  const rs = c.recipients ?? [];
  if (!rs.length) return c.stats;
  const attributed = attributedAppointments(c, appointments, leads);
  return {
    total: rs.length,
    sent: rs.filter((r) => r.status !== "pendente").length,
    delivered: rs.filter((r) => ["entregue", "respondeu", "optout"].includes(r.status)).length,
    replied: rs.filter((r) => r.status === "respondeu" || r.status === "optout").length,
    converted: attributed.length,
  };
}

export function campaignRevenue(c: Campaign, appointments: Appointment[], leads: Lead[]) {
  const attributed = attributedAppointments(c, appointments, leads);
  return {
    realizada: attributed.filter((a) => a.status === "compareceu").reduce((s, a) => s + a.value, 0),
    aRealizar: attributed.filter((a) => a.status === "agendado" || a.status === "confirmado").reduce((s, a) => s + a.value, 0),
  };
}

/** Primeiro horário livre de um profissional nos próximos dias (usado na simulação de auto-agendamento). */
export function findFreeSlot(appointments: Appointment[], professionalId: ID, durationMin: number, from = new Date()) {
  for (let d = 1; d <= 14; d++) {
    const day = addDays(startOfDay(from), d);
    if (day.getDay() === 0) continue;
    const end = day.getDay() === 6 ? 12 : 19;
    const busy = appointments.filter((a) => a.professionalId === professionalId && a.status !== "cancelado" && format(parseISO(a.start), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));
    for (let h = 9; h < end; h++) {
      if (h === 12) continue;
      for (const m of [0, 30]) {
        const s = setMinutes(setHours(day, h), m);
        const e = addMinutes(s, durationMin);
        if (!busy.some((a) => parseISO(a.start) < e && addMinutes(parseISO(a.start), a.durationMin) > s)) return s;
      }
    }
  }
  return undefined;
}

export const POSITIVE_REPLIES = [
  "Oi! Tenho interesse sim, quais horários vocês têm?",
  "Obrigada por lembrar! Quero retomar, pode me passar os horários?",
  "Pode sim, prefiro online se tiver",
  "Quero agendar, tem algo na semana que vem?",
];
export const NEGATIVE_REPLIES = ["Agora não, obrigado", "No momento estou sem condições, depois eu chamo", "Já estou me tratando em outro lugar, obrigada"];
