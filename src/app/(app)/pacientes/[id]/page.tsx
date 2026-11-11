"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { parseISO } from "date-fns";
import {
  AlertTriangle, ArrowLeft, Bot, CalendarPlus, Cake, Clock, CreditCard, FileText, HeartPulse, ListPlus, Mail, MessageCircle, Pencil, Phone, Plus, Send, ShieldCheck, Unlink, UserRound, Users, Video,
} from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Empty, Tabs, Textarea, toast } from "@/components/ui";
import { PatientFormModal } from "@/components/forms/patient-form";
import { AppointmentFormModal } from "@/components/forms/appointment-form";
import { BudgetFormModal } from "@/components/forms/budget-form";
import { GuardianModal, PlanModal, StatusBadge, TagEditor, TaskModal, WaitlistModal } from "@/components/organize";
import { useApp, useCurrentUser } from "@/lib/store";
import { useOrganize } from "@/lib/use-organize";
import { can } from "@/lib/permissions";
import { APT_STATUS } from "@/lib/labels";
import { STATUS_META } from "@/lib/organize";
import { ageFrom, cn, fmtDate, fmtRelative, maskCPF, maskPhone, money } from "@/lib/utils";

type Tab = "geral" | "tratamento" | "conversas" | "agendamentos" | "financeiro";

export default function PacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const user = useCurrentUser();
  const patients = useApp((s) => s.patients);
  const patient = patients.find((p) => p.id === id);
  const allApts = useApp((s) => s.appointments);
  const allConvs = useApp((s) => s.conversations);
  const allMsgs = useApp((s) => s.messages);
  const allBudgets = useApp((s) => s.budgets);
  const allTrx = useApp((s) => s.transactions);
  const allLeads = useApp((s) => s.leads);
  const allPlans = useApp((s) => s.plans);
  const procedures = useApp((s) => s.procedures);
  const professionals = useApp((s) => s.professionals);
  const { addPatientNote, setBudgetStatus, setPlanStatus, setGuardian } = useApp.getState();
  const { status, progress, idx } = useOrganize();
  const [tab, setTab] = useState<Tab>("geral");
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [apt, setApt] = useState<{ procedureId?: string; professionalId?: string } | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "tratamento") setTab("tratamento");
  }, []);

  const apts = useMemo(() => allApts.filter((a) => a.patientId === id).sort((a, b) => b.start.localeCompare(a.start)), [allApts, id]);
  const convs = useMemo(() => allConvs.filter((c) => c.patientId === id), [allConvs, id]);
  const leadIds = useMemo(() => new Set(allLeads.filter((l) => l.patientId === id).map((l) => l.id)), [allLeads, id]);
  const budgets = useMemo(() => allBudgets.filter((b) => b.patientId === id || (b.leadId && leadIds.has(b.leadId))), [allBudgets, id, leadIds]);
  const payments = useMemo(() => allTrx.filter((t) => t.patientId === id && t.type === "entrada").sort((a, b) => b.date.localeCompare(a.date)), [allTrx, id]);
  const plans = useMemo(() => allPlans.filter((p) => p.patientId === id), [allPlans, id]);
  const dependents = useMemo(() => patients.filter((p) => p.guardianId === id), [patients, id]);

  if (!patient) {
    return <Empty title="Paciente não encontrado" action={<Link href="/pacientes"><Button variant="outline">Voltar</Button></Link>} />;
  }

  const guardian = patients.find((p) => p.id === patient.guardianId);
  const now = new Date().toISOString();
  const future = apts.filter((a) => a.start >= now && a.status !== "cancelado").reverse();
  const past = apts.filter((a) => a.start < now);
  const totalPaid = payments.reduce((s, t) => s + t.amount, 0);
  const noShows = past.filter((a) => a.status === "faltou").length;
  const canEdit = can(user?.role, "pacientes.edit");
  const showMoney = can(user?.role, "financeiro.view") || user?.role === "recepcao";
  const birthdayMonth = parseISO(patient.birthDate).getMonth() === new Date().getMonth();
  const st = status[patient.id];
  const age = ageFrom(patient.birthDate);
  const stalledCount = plans.filter((p) => progress[p.id]?.stalled).length;

  const tabs: { value: Tab; label: React.ReactNode; count?: number }[] = [
    { value: "geral", label: "Visão geral" },
    { value: "tratamento", label: <span className="flex items-center gap-1">Tratamento{stalledCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}</span>, count: plans.length },
    { value: "conversas", label: "WhatsApp", count: convs.length },
    { value: "agendamentos", label: "Agendamentos", count: apts.length },
    ...(showMoney ? [{ value: "financeiro" as Tab, label: "Financeiro", count: budgets.length + payments.length }] : []),
  ];

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <Link href="/pacientes" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"><ArrowLeft size={13} /> Pacientes</Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={patient.name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{patient.name}</h1>
              <StatusBadge status={st} />
              <Badge tone={patient.insurance.startsWith("Particular") ? "neutral" : "info"}>{patient.insurance}</Badge>
              {birthdayMonth && <Badge tone="violet"><Cake size={11} /> Aniversariante do mês</Badge>}
              {noShows >= 2 && <Badge tone="danger">{noShows} faltas</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1.5"><CreditCard size={14} /> CPF {maskCPF(patient.cpf)}</span>
              <span className="flex items-center gap-1.5"><Phone size={14} /> {maskPhone(patient.phone)}{guardian && " (do responsável)"}</span>
              <span className="flex items-center gap-1.5"><Mail size={14} /> {patient.email}</span>
              <span className="flex items-center gap-1.5"><Cake size={14} /> {fmtDate(patient.birthDate)} ({age} anos)</span>
            </div>
            <div className="mt-3">
              {canEdit ? <TagEditor patientId={patient.id} value={patient.tags} /> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {convs[0] && <Link href={`/atendimento?c=${convs[0].id}`}><Button variant="outline"><MessageCircle size={15} /> WhatsApp</Button></Link>}
            {canEdit && <Button variant="outline" onClick={() => setTaskOpen(true)}><ListPlus size={15} /> Tarefa</Button>}
            {canEdit && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil size={15} /> Editar</Button>}
            {canEdit && <Button onClick={() => setApt({})}><CalendarPlus size={15} /> Agendar</Button>}
          </div>
        </div>
        {guardian && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-info-soft px-3 py-2 text-sm">
            <ShieldCheck size={15} className="text-info" />
            Responsável legal: <Link href={`/pacientes/${guardian.id}`} className="font-semibold hover:underline">{guardian.name}</Link>
            <span className="text-muted">({patient.guardianRelation})</span>
            {age < 18 && <span className="ml-auto text-xs text-muted">Menor de idade: comunicações e cobranças vão para o responsável</span>}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <Mini label="Paciente desde" value={fmtDate(patient.createdAt, "MMM/yyyy")} />
          <Mini label="Última consulta" value={idx[patient.id]?.lastVisit ? fmtRelative(idx[patient.id]!.lastVisit!) : "—"} />
          <Mini label="Próximo agendamento" value={future[0] ? fmtDate(future[0].start, "dd/MM 'às' HH:mm") : "—"} />
          {showMoney ? <Mini label="Total investido" value={money(totalPaid)} /> : <Mini label="Status" value={STATUS_META[st].label} />}
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} items={tabs} />

      {tab === "geral" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Observações da clínica" subtitle="Histórico comercial e administrativo. Informações clínicas ficam no prontuário médico." />
            <div className="px-5 pb-5">
              {canEdit && (
                <div className="mb-4 flex gap-2">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar observação…" className="min-h-10" />
                  <Button size="icon" className="h-10 w-10 shrink-0" disabled={!note.trim()} onClick={() => { addPatientNote(patient.id, note.trim()); setNote(""); toast("Observação adicionada"); }} aria-label="Adicionar observação">
                    <Send size={15} />
                  </Button>
                </div>
              )}
              {patient.notes.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhuma observação registrada.</p>}
              <ol className="space-y-3">
                {patient.notes.map((n) => (
                  <li key={n.id} className="relative border-l-2 border-primary/30 pl-4">
                    <p className="text-sm">{n.text}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{n.authorName} · {fmtDate(n.createdAt, "dd/MM/yyyy HH:mm")}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Família" subtitle="Responsável legal e dependentes" action={canEdit && !guardian && <Button size="sm" variant="outline" onClick={() => setGuardianOpen(true)}><Users size={13} /> Responsável</Button>} />
              <div className="space-y-2 px-5 pb-5 text-sm">
                {guardian && (
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Avatar name={guardian.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/pacientes/${guardian.id}`} className="block truncate font-medium hover:text-primary">{guardian.name}</Link>
                      <p className="text-xs text-muted">{patient.guardianRelation} · responsável</p>
                    </div>
                    {canEdit && <button className="text-muted hover:text-danger cursor-pointer" onClick={() => setGuardian(patient.id, undefined)} aria-label="Desvincular"><Unlink size={14} /></button>}
                  </div>
                )}
                {dependents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Avatar name={d.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/pacientes/${d.id}`} className="block truncate font-medium hover:text-primary">{d.name}</Link>
                      <p className="text-xs text-muted">Dependente · {ageFrom(d.birthDate)} anos</p>
                    </div>
                    <StatusBadge status={status[d.id]} />
                  </div>
                ))}
                {!guardian && dependents.length === 0 && <p className="text-xs text-muted">Sem vínculos familiares.</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Dados cadastrais" />
              <dl className="space-y-2.5 px-5 pb-5 text-sm">
                {[
                  ["CPF", maskCPF(patient.cpf)],
                  ["Nascimento", fmtDate(patient.birthDate)],
                  ["Convênio", patient.insurance],
                  ["Como conheceu", patient.source],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="truncate text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              {canEdit && <div className="px-5 pb-5"><Button size="sm" variant="outline" className="w-full justify-center" onClick={() => setWaitOpen(true)}><Clock size={13} /> Colocar na lista de espera</Button></div>}
            </Card>
          </div>
        </div>
      )}

      {tab === "tratamento" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Planos de tratamento: acompanhe as sessões realizadas e retome quem parou no meio.</p>
            {canEdit && <Button onClick={() => setPlanOpen(true)}><Plus size={15} /> Novo plano</Button>}
          </div>
          {plans.length === 0 && <Card><Empty icon={<HeartPulse size={32} strokeWidth={1.4} />} title="Nenhum plano de tratamento" text="Crie um plano (ex.: psicoterapia 24 sessões, protocolo EMT) para acompanhar o progresso." /></Card>}
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((pl) => {
              const pr = progress[pl.id];
              const prof = professionals.find((p) => p.id === pl.professionalId);
              const proc = procedures.find((p) => p.id === pl.procedureId);
              return (
                <Card key={pl.id} className={cn("p-5", pr.stalled && "border-warning/50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{pl.title}</p>
                      <p className="text-xs text-muted">{prof?.name} · a cada {pl.frequencyDays} dia(s) · desde {fmtDate(pl.createdAt)}</p>
                    </div>
                    <Badge tone={pl.status === "concluido" ? "success" : pl.status === "interrompido" ? "danger" : pr.stalled ? "warning" : "primary"}>
                      {pl.status === "concluido" ? "Concluído" : pl.status === "interrompido" ? "Interrompido" : pr.stalled ? "Parado" : "Em andamento"}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs">
                      <span><b className="text-base">{pr.done}</b> de {pl.totalSessions} sessões</span>
                      <span className="text-muted">{Math.round(pr.pct * 100)}%</span>
                    </div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-surface-2">
                      <div className={cn("h-full rounded-full", pr.stalled ? "bg-warning" : "bg-primary")} style={{ width: `${pr.pct * 100}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-muted">Última</p><p className="font-medium">{pr.lastSession ? fmtDate(pr.lastSession, "dd/MM/yy") : "—"}</p></div>
                    <div><p className="text-muted">Próxima</p><p className="font-medium">{pr.nextSession ? fmtDate(pr.nextSession.start, "dd/MM HH:mm") : "—"}</p></div>
                    {showMoney && <div><p className="text-muted">A realizar</p><p className="font-medium">{money(pr.remainingValue)}</p></div>}
                  </div>
                  {pr.stalled && (
                    <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                      <AlertTriangle size={13} /> Sem sessão há {pr.daysSinceLast} dias e nada agendado. Risco de abandono do tratamento.
                    </p>
                  )}
                  {canEdit && pl.status === "ativo" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setApt({ procedureId: pl.procedureId, professionalId: pl.professionalId })}><CalendarPlus size={13} /> Agendar próxima sessão</Button>
                      {pr.stalled && <Button size="sm" variant="outline" onClick={() => toast(`Mensagem de retomada enviada para ${patient.name.split(" ")[0]} (simulação)`)}><Send size={13} /> Enviar retomada</Button>}
                      <Button size="sm" variant="ghost" onClick={() => { setPlanStatus(pl.id, "concluido"); toast("Plano concluído"); }}>Concluir</Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setPlanStatus(pl.id, "interrompido")}>Interromper</Button>
                    </div>
                  )}
                  {proc && <p className="mt-3 text-[11px] text-muted">{proc.name} · {money(proc.price)} por sessão</p>}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tab === "conversas" && (
        <Card className="p-5">
          {convs.length === 0 ? (
            <Empty icon={<MessageCircle size={32} strokeWidth={1.4} />} title="Sem conversas vinculadas" text="Conversas do WhatsApp aparecem aqui quando vinculadas ao cadastro." />
          ) : (
            <div className="space-y-6">
              {convs.map((c) => (
                <div key={c.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{c.department} · iniciada {fmtRelative(c.createdAt)}</p>
                    <Link href={`/atendimento?c=${c.id}`} className="text-xs font-medium text-primary">Abrir no atendimento →</Link>
                  </div>
                  <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-xl bg-chat-bg p-3">
                    {allMsgs.filter((m) => m.conversationId === c.id).map((m) =>
                      m.author === "sistema" ? (
                        <p key={m.id} className="text-center text-[11px] text-muted">{m.text}</p>
                      ) : (
                        <div key={m.id} className={cn("flex", m.author === "contato" ? "justify-start" : "justify-end")}>
                          <div className={cn("max-w-[75%] rounded-xl px-3 py-1.5 text-sm", m.author === "contato" ? "bg-bubble-in" : m.author === "ia" ? "bg-bubble-ia" : "bg-bubble-out")}>
                            {m.author !== "contato" && <p className="flex items-center gap-1 text-[10px] font-semibold text-muted">{m.author === "ia" ? <Bot size={10} /> : <UserRound size={10} />}{m.authorName}</p>}
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            <p className="text-right text-[10px] text-muted">{fmtDate(m.createdAt, "dd/MM HH:mm")}</p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "agendamentos" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {([["Próximos", future], ["Histórico", past]] as const).map(([title, list]) => (
            <Card key={title}>
              <CardHeader title={title} subtitle={`${list.length} registro(s)`} />
              <div className="max-h-[480px] divide-y divide-border overflow-y-auto px-2 pb-2">
                {list.length === 0 && <p className="p-6 text-center text-sm text-muted">Nada por aqui.</p>}
                {list.map((a) => {
                  const prof = professionals.find((p) => p.id === a.professionalId);
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="h-8 w-1 rounded-full" style={{ background: prof?.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-sm font-medium">{a.modality === "online" && <Video size={12} className="text-info" />}{procedures.find((p) => p.id === a.procedureId)?.name}</p>
                        <p className="text-xs text-muted">{fmtDate(a.start, "dd/MM/yyyy 'às' HH:mm")} · {prof?.name}</p>
                      </div>
                      {showMoney && <span className="text-xs text-muted">{money(a.value)}</span>}
                      <Badge tone={APT_STATUS[a.status].tone}>{APT_STATUS[a.status].label}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "financeiro" && showMoney && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Orçamentos" action={canEdit && <Button size="sm" variant="outline" onClick={() => setBudgetOpen(true)}><FileText size={13} /> Novo</Button>} />
            <div className="divide-y divide-border px-2 pb-2">
              {budgets.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhum orçamento.</p>}
              {budgets.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.items.map((i) => `${i.qty}x ${i.description}`).join(", ")}</p>
                    <p className="text-xs text-muted">{fmtDate(b.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold">{money(b.total)}</span>
                  {b.status === "aberto" && canEdit ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setBudgetStatus(b.id, "aprovado")}>Aprovar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setBudgetStatus(b.id, "recusado")}>Recusar</Button>
                    </div>
                  ) : (
                    <Badge tone={b.status === "aprovado" ? "success" : b.status === "recusado" ? "danger" : "warning"}>{b.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Pagamentos realizados" subtitle={`Total: ${money(totalPaid)}`} />
            <div className="max-h-[480px] divide-y divide-border overflow-y-auto px-2 pb-2">
              {payments.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhum pagamento.</p>}
              {payments.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.description.split(" — ")[0]}</p>
                    <p className="text-xs text-muted">{fmtDate(t.date)} · {t.method}</p>
                  </div>
                  <span className="text-sm font-semibold text-success">+ {money(t.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <PatientFormModal open={editOpen} onClose={() => setEditOpen(false)} patient={patient} />
      <AppointmentFormModal open={!!apt} onClose={() => setApt(null)} patientId={patient.id} procedureId={apt?.procedureId} professionalId={apt?.professionalId} />
      <BudgetFormModal open={budgetOpen} onClose={() => setBudgetOpen(false)} patientId={patient.id} />
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} patientId={patient.id} />
      <GuardianModal open={guardianOpen} onClose={() => setGuardianOpen(false)} patientId={patient.id} />
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} patientId={patient.id} defaultTitle={`Retornar contato — ${patient.name}`} />
      <WaitlistModal open={waitOpen} onClose={() => setWaitOpen(false)} patientId={patient.id} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
