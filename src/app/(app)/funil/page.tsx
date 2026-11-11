"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openCampaignDraft } from "@/lib/campaign-draft";
import { isRecoverable, RECOVERABLE_WINDOW_DAYS } from "@/lib/campaigns";
import { can } from "@/lib/permissions";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, DragOverlay, type DragStartEvent } from "@dnd-kit/core";
import { differenceInDays, parseISO, subDays } from "date-fns";
import { CalendarCheck, Clock, FileText, MessageCircle, Plus, Search, Send, UserRound } from "lucide-react";
import { Avatar, Badge, Button, Field, Input, Modal, PageHeader, Select, Textarea, toast } from "@/components/ui";
import { AppointmentFormModal } from "@/components/forms/appointment-form";
import { PatientFormModal } from "@/components/forms/patient-form";
import { BudgetFormModal } from "@/components/forms/budget-form";
import { useApp, useCurrentUser } from "@/lib/store";
import { STAGES } from "@/lib/labels";
import { SOURCES, type Lead, type LeadStage, type Source } from "@/lib/types";
import { cn, fmtDate, fmtRelative, maskPhone, money, moneyCompact, normalizePhone } from "@/lib/utils";

const LOST_REASONS = ["Achou caro", "Sem resposta após orçamento", "Fechou com outra clínica", "Sem disponibilidade de horário", "Apenas pesquisando preço", "Outro"];

export default function FunilPage() {
  const leads = useApp((s) => s.leads);
  const users = useApp((s) => s.users);
  const { moveLead } = useApp.getState();
  const router = useRouter();
  const canCampaign = can(useCurrentUser()?.role, "campanhas.edit");
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"" | Source>("");
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [lostFor, setLostFor] = useState<Lead | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Lead | null>(null);
  const [patientFor, setPatientFor] = useState<Lead | null>(null);
  const [detail, setDetail] = useState<Lead | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [budgetFor, setBudgetFor] = useState<Lead | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const cutoff = subDays(new Date(), 30).toISOString();

  const visible = useMemo(
    () =>
      leads.filter(
        (l) =>
          (!["realizado", "perdido"].includes(l.stage) || l.stageChangedAt >= cutoff) &&
          (!q || l.name.toLowerCase().includes(q.toLowerCase()) || l.interest.toLowerCase().includes(q.toLowerCase())) &&
          (!source || l.source === source),
      ),
    [leads, q, source, cutoff],
  );

  const onDragStart = (e: DragStartEvent) => setDragging(leads.find((l) => l.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const lead = leads.find((l) => l.id === e.active.id);
    const to = e.over?.id as LeadStage | undefined;
    if (!lead || !to || lead.stage === to) return;
    if (to === "perdido") return setLostFor(lead);
    if (to === "agendado" && !lead.appointmentId) {
      if (!lead.patientId) return setPatientFor(lead);
      return setScheduleFor(lead);
    }
    if (to === "orcamento" && !lead.budgetId) return setBudgetFor(lead);
    moveLead(lead.id, to);
    toast(`${lead.name.split(" ")[0]} movido para "${STAGES.find((s) => s.id === to)?.label}"`);
  };

  const openValue = visible.filter((l) => ["qualificacao", "orcamento"].includes(l.stage)).reduce((s, l) => s + l.estimatedValue, 0);

  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      <PageHeader
        title="Funil de pacientes"
        subtitle={`Jornada do primeiro contato ao procedimento · ${moneyCompact(openValue)} em negociação`}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar lead…" className="w-48 pl-8" />
            </div>
            <Select value={source} onChange={(e) => setSource(e.target.value as Source | "")} className="w-48">
              <option value="">Todas as origens</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Button onClick={() => setNewOpen(true)}><Plus size={15} /> Novo lead</Button>
          </>
        }
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="-mx-4 flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-2 lg:-mx-6 lg:px-6">
          {STAGES.map((st) => {
            const items = visible.filter((l) => l.stage === st.id).sort((a, b) => b.stageChangedAt.localeCompare(a.stageChangedAt));
            return (
              <Column key={st.id} stage={st} count={items.length} total={items.reduce((s, l) => s + l.estimatedValue, 0)}>
                {items.map((l) => (
                  <DraggableCard key={l.id} lead={l} owner={users.find((u) => u.id === l.ownerUserId)?.name} onOpen={() => setDetail(l)} />
                ))}
                {st.id === "perdido" && canCampaign && (() => {
                  const rec = leads.filter((l) => isRecoverable(l));
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-center"
                      disabled={!rec.length}
                      title={`Perdidos há até ${RECOVERABLE_WINDOW_DAYS} dias por preço, horário ou falta de resposta`}
                      onClick={() =>
                        openCampaignDraft(router.push, {
                          name: "Recuperação de leads perdidos (funil)",
                          channel: "whatsapp",
                          audience: "lista_manual",
                          manualTargets: rec.map((l) => l.id),
                          messages: [{ text: "Oi {{nome}}, tudo bem? Aqui é do {{clinica}} 💚 Há um tempo você falou com a gente e queríamos saber se ainda podemos te ajudar. Temos novos horários (presenciais e online), parcelamento e nota para reembolso. Se não quiser mais receber mensagens, responda SAIR." }],
                        })
                      }
                    >
                      <Send size={13} /> Recuperar {rec.length} recuperáveis
                    </Button>
                  );
                })()}
              </Column>
            );
          })}
        </div>
        <DragOverlay>{dragging && <LeadCard lead={dragging} overlay />}</DragOverlay>
      </DndContext>
      <p className="mt-2 text-[11px] text-muted">Colunas "Realizado" e "Perdido" mostram os últimos 30 dias. Arraste os cards entre as etapas.</p>

      <LostModal lead={lostFor} onClose={() => setLostFor(null)} />
      <PatientFormModal
        open={!!patientFor}
        onClose={() => setPatientFor(null)}
        initial={patientFor ? { name: patientFor.name, phone: patientFor.phone, source: patientFor.source } : undefined}
        onSaved={(p) => {
          if (!patientFor) return;
          useApp.getState().updateLead(patientFor.id, { patientId: p.id });
          const l = { ...patientFor, patientId: p.id };
          setTimeout(() => setScheduleFor(l), 50);
        }}
      />
      <AppointmentFormModal open={!!scheduleFor} onClose={() => setScheduleFor(null)} patientId={scheduleFor?.patientId} leadId={scheduleFor?.id} />
      <BudgetFormModal open={!!budgetFor} onClose={() => setBudgetFor(null)} leadId={budgetFor?.id} patientId={budgetFor?.patientId} />
      <LeadDetail lead={detail ? leads.find((l) => l.id === detail.id) ?? null : null} onClose={() => setDetail(null)} onSchedule={(l) => { setDetail(null); if (l.patientId) setScheduleFor(l); else setPatientFor(l); }} onBudget={(l) => { setDetail(null); setBudgetFor(l); }} />
      <NewLeadModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function Column({ stage, count, total, children }: { stage: (typeof STAGES)[number]; count: number; total: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="flex w-[290px] shrink-0 flex-col rounded-xl bg-surface-2/70">
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
          <p className="text-[13px] font-semibold">{stage.label}</p>
          <span className="ml-auto rounded-full bg-surface px-2 text-[11px] font-medium text-muted">{count}</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted">{stage.hint} · <b className="text-fg">{moneyCompact(total)}</b></p>
      </div>
      <div ref={setNodeRef} className={cn("flex-1 space-y-2 overflow-y-auto rounded-b-xl p-2 transition", isOver && "bg-primary-soft/60 ring-2 ring-primary/40 ring-inset")}>
        {children}
      </div>
    </div>
  );
}

function DraggableCard({ lead, owner, onOpen }: { lead: Lead; owner?: string; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onOpen} className={cn(isDragging && "opacity-30")}>
      <LeadCard lead={lead} owner={owner} />
    </div>
  );
}

function LeadCard({ lead, owner, overlay }: { lead: Lead; owner?: string; overlay?: boolean }) {
  const days = differenceInDays(new Date(), parseISO(lead.stageChangedAt));
  const stale = lead.stage === "orcamento" && days >= 3;
  return (
    <div className={cn("cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm transition hover:border-primary/50 hover:shadow-md active:cursor-grabbing", overlay && "rotate-2 shadow-xl")}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm font-medium leading-tight">{lead.name}</p>
        {owner && <Avatar name={owner} size={22} />}
      </div>
      <p className="mt-1 text-xs text-muted">{lead.interest}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {lead.estimatedValue > 0 && <span className="text-xs font-semibold">{money(lead.estimatedValue)}</span>}
        <Badge tone={lead.source === "Indicação" ? "success" : lead.source === "Meta Ads" || lead.source === "Google" ? "info" : "neutral"}>{lead.source}</Badge>
        <span className={cn("ml-auto flex items-center gap-1 text-[10px]", stale ? "font-semibold text-warning" : "text-muted")}>
          <Clock size={10} /> {days === 0 ? "hoje" : `${days}d`}
        </span>
      </div>
      {(lead.conversationId || lead.appointmentId || lead.lostReason) && (
        <div className="mt-2 flex items-center gap-2 border-t border-border/70 pt-2 text-[10px] text-muted">
          {lead.conversationId && <span className="flex items-center gap-1"><MessageCircle size={10} /> WhatsApp</span>}
          {lead.appointmentId && <span className="flex items-center gap-1 text-primary"><CalendarCheck size={10} /> Agendado</span>}
          {lead.lostReason && <span className="truncate text-danger">{lead.lostReason}</span>}
        </div>
      )}
    </div>
  );
}

function LostModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const [reason, setReason] = useState(LOST_REASONS[0]);
  return (
    <Modal
      open={!!lead}
      onClose={onClose}
      size="sm"
      title="Marcar como perdido"
      subtitle={lead?.name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={() => { if (lead) { useApp.getState().moveLead(lead.id, "perdido", reason); toast("Lead marcado como perdido"); } onClose(); }}>Confirmar</Button>
        </>
      }
    >
      <Field label="Motivo da perda" hint="Usado nos relatórios e nas automações de recuperação">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
      </Field>
    </Modal>
  );
}

function LeadDetail({ lead, onClose, onSchedule, onBudget }: { lead: Lead | null; onClose: () => void; onSchedule: (l: Lead) => void; onBudget: (l: Lead) => void }) {
  const budget = useApp((s) => s.budgets.find((b) => b.id === lead?.budgetId));
  const patient = useApp((s) => s.patients.find((p) => p.id === lead?.patientId));
  const { moveLead } = useApp.getState();
  if (!lead) return null;
  return (
    <Modal open onClose={onClose} title={lead.name} subtitle={`${maskPhone(lead.phone)} · entrou ${fmtRelative(lead.createdAt)}`}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Interesse" value={lead.interest} />
        <Info label="Valor potencial" value={money(lead.estimatedValue)} />
        <Info label="Origem" value={lead.source} />
        <Info label="Na etapa desde" value={fmtDate(lead.stageChangedAt)} />
        {patient && <Info label="Paciente vinculado" value={<Link className="text-primary underline" href={`/pacientes/${patient.id}`}>{patient.name}</Link>} />}
        {budget && <Info label="Orçamento" value={`${money(budget.total)} · ${budget.status}`} />}
        {lead.lostReason && <Info label="Motivo da perda" value={lead.lostReason} />}
      </div>
      <Field label="Etapa" className="mt-4">
        <Select value={lead.stage} onChange={(e) => moveLead(lead.id, e.target.value as LeadStage)}>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </Field>
      <div className="mt-4 flex flex-wrap gap-2">
        {lead.conversationId && (
          <Link href={`/atendimento?c=${lead.conversationId}`}>
            <Button variant="outline" size="sm"><MessageCircle size={13} /> Abrir conversa</Button>
          </Link>
        )}
        <Button variant="outline" size="sm" onClick={() => onBudget(lead)}><FileText size={13} /> Criar orçamento</Button>
        <Button size="sm" onClick={() => onSchedule(lead)}><CalendarCheck size={13} /> Agendar</Button>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function NewLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: "", phone: "", source: "Indicação" as Source, interest: "", value: 0, note: "" });
  const save = () => {
    useApp.getState().addLead({ name: f.name.trim(), phone: normalizePhone(f.phone), source: f.source, stage: "novo", interest: f.interest || "Primeira consulta psiquiátrica", estimatedValue: f.value });
    toast("Lead criado");
    setF({ name: "", phone: "", source: "Indicação", interest: "", value: 0, note: "" });
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="Novo lead" footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!f.name.trim()} onClick={save}>Criar lead</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="WhatsApp"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: maskPhone(e.target.value) })} /></Field>
        <Field label="Origem"><Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as Source })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Valor potencial (R$)"><Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></Field>
        <Field label="Interesse" className="sm:col-span-2"><Input value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })} placeholder="Ex.: Clareamento" /></Field>
        <Field label="Observação" className="sm:col-span-2"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs text-muted"><UserRound size={12} /> Leads de WhatsApp são criados automaticamente pela automação.</p>
    </Modal>
  );
}
