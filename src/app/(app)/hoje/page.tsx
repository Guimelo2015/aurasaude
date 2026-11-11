"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, differenceInDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { create } from "zustand";
import {
  AlertTriangle, CalendarCheck, CalendarClock, CalendarPlus, Cake, CheckCircle2, Clock, FileText, Gift, HeartPulse, ListChecks,
  MessageCircle, Phone, Plus, RefreshCw, Send, Trash2, UserPlus, Video, XCircle,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, Tabs, toast } from "@/components/ui";
import { TaskModal, WaitlistModal } from "@/components/organize";
import { AppointmentFormModal } from "@/components/forms/appointment-form";
import { useApp, useCurrentUser } from "@/lib/store";
import { useOrganize } from "@/lib/use-organize";
import { overdueReturns } from "@/lib/organize";
import type { ID, Patient } from "@/lib/types";
import { capitalizeFirst, cn, fmtTime, money, shortName } from "@/lib/utils";

const firstLast = (name: string) => {
  const p = name.split(" ");
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : name;
};

/** Itens resolvidos hoje nesta sessão (convites enviados, parabéns, cobranças). */
const useDone = create<{ done: Record<string, true>; mark: (k: string) => void }>((set) => ({
  done: {},
  mark: (k) => set((s) => ({ done: { ...s.done, [k]: true } })),
}));

export default function MeuDiaPage() {
  const me = useCurrentUser();
  const patients = useApp((s) => s.patients);
  const appointments = useApp((s) => s.appointments);
  const procedures = useApp((s) => s.procedures);
  const professionals = useApp((s) => s.professionals);
  const leads = useApp((s) => s.leads);
  const tasks = useApp((s) => s.tasks);
  const waitlist = useApp((s) => s.waitlist);
  const users = useApp((s) => s.users);
  const { sendConfirmations, toggleTask, deleteTask, fillSlotFromWaitlist, removeFromWaitlist, sendMessage, addTask } = useApp.getState();
  const { idx, stalledPlans, progress } = useOrganize();
  const done = useDone((s) => s.done);
  const mark = useDone((s) => s.mark);

  const [taskOpen, setTaskOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);
  const [taskScope, setTaskScope] = useState<"minhas" | "todas">("todas");
  const [schedule, setSchedule] = useState<{ patientId: ID; procedureId?: ID; professionalId?: ID } | null>(null);

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = (() => {
    let d = addDays(startOfDay(now), 1);
    if (d.getDay() === 0) d = addDays(d, 1);
    return d;
  })();

  const pat = (id: ID) => patients.find((p) => p.id === id);
  const procName = (id: ID) => procedures.find((p) => p.id === id)?.name ?? "";
  const profOf = (id: ID) => professionals.find((p) => p.id === id);

  // 1) confirmações de amanhã
  const tomorrowApts = useMemo(
    () => appointments.filter((a) => isSameDay(parseISO(a.start), tomorrow) && a.status !== "compareceu").sort((a, b) => a.start.localeCompare(b.start)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, tomorrow.getTime()],
  );
  const toConfirm = tomorrowApts.filter((a) => !a.confirmation && a.status === "agendado");
  const confirmed = tomorrowApts.filter((a) => a.confirmation === "confirmou" || a.status === "confirmado");
  const noAnswer = tomorrowApts.filter((a) => a.confirmation === "sem_resposta");
  const waiting = tomorrowApts.filter((a) => a.confirmation === "enviada");

  // 2) horários liberados (cancelados no futuro, ainda não reaproveitados)
  const freed = appointments
    .filter((a) => a.status === "cancelado" && parseISO(a.start) > now && !a.notes?.includes("reaproveitado"))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  // 3) tarefas
  const visibleTasks = tasks
    .filter((t) => taskScope === "todas" || t.assignedUserId === me?.id)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate));
  const openTasks = visibleTasks.filter((t) => !t.done);

  // 4) orçamentos parados
  const staleBudgets = leads
    .filter((l) => l.stage === "orcamento" && differenceInDays(now, parseISO(l.stageChangedAt)) >= 3 && !done[`orc-${l.id}`])
    .sort((a, b) => b.estimatedValue - a.estimatedValue)
    .slice(0, 6);

  // 5) retornos vencidos
  const returns = useMemo(() => overdueReturns(patients, idx).filter((r) => !done[`ret-${r.patient.id}`]).slice(0, 7), [patients, idx, done]);

  // 6) tratamentos interrompidos
  const stalled = stalledPlans.filter((p) => !done[`plan-${p.id}`]).sort((a, b) => progress[b.id].remainingValue - progress[a.id].remainingValue).slice(0, 6);

  // 7) aniversariantes da semana
  const birthdays = patients
    .map((p) => {
      const b = parseISO(p.birthDate);
      let next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
      if (next < startOfDay(now)) next = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
      return { p, next, days: differenceInDays(next, startOfDay(now)) };
    })
    .filter((x) => x.days <= 7 && !done[`bday-${x.p.id}`])
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  const pendencias = toConfirm.length + noAnswer.length + openTasks.filter((t) => t.dueDate <= today).length + staleBudgets.length + returns.length + stalled.length + freed.length;

  const remind = (p: Patient | undefined, key: string, msg: string) => {
    mark(key);
    toast(`${msg} — ${p ? shortName(p.name) : ""} (WhatsApp simulado)`);
  };

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Meu dia</h1>
          <p className="text-sm text-muted">{capitalizeFirst(format(now, "EEEE, d 'de' MMMM", { locale: ptBR }))} · tudo o que precisa da sua atenção hoje, em um só lugar</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={pendencias ? "warning" : "success"} className="px-2.5 py-1 text-xs">
            {pendencias ? `${pendencias} pendências` : "Tudo em dia ✨"}
          </Badge>
          <Button variant="outline" onClick={() => setWaitOpen(true)}><UserPlus size={15} /> Lista de espera</Button>
          <Button onClick={() => setTaskOpen(true)}><Plus size={15} /> Nova tarefa</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Confirmações */}
        <Section
          icon={CalendarCheck}
          title={`Confirmações de ${format(tomorrow, "EEEE (dd/MM)", { locale: ptBR })}`}
          subtitle="O sistema envia a mensagem pelo WhatsApp e atualiza a agenda com a resposta do paciente"
          action={
            <Button size="sm" disabled={!toConfirm.length} onClick={() => { sendConfirmations(toConfirm.map((a) => a.id)); toast(`${toConfirm.length} confirmações enviadas pelo WhatsApp`); }}>
              <Send size={13} /> Enviar confirmação ({toConfirm.length})
            </Button>
          }
        >
          <div className="mb-3 grid grid-cols-4 gap-2 text-center">
            <Counter label="A enviar" value={toConfirm.length} tone="neutral" />
            <Counter label="Aguardando" value={waiting.length} tone="info" />
            <Counter label="Confirmados" value={confirmed.length} tone="success" />
            <Counter label="Sem resposta" value={noAnswer.length} tone="warning" />
          </div>
          <div className="max-h-72 divide-y divide-border overflow-y-auto">
            {tomorrowApts.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhum agendamento para amanhã.</p>}
            {tomorrowApts.map((a) => {
              const p = pat(a.patientId);
              const prof = profOf(a.professionalId);
              return (
                <div key={a.id} className="flex items-center gap-3 py-2">
                  <span className="w-11 text-sm font-semibold tabular-nums">{fmtTime(a.start)}</span>
                  <span className="h-7 w-1 rounded-full" style={{ background: prof?.color }} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/pacientes/${p?.id}`} className="block truncate text-sm font-medium hover:text-primary">{p?.name}</Link>
                    <p className="flex items-center gap-1 truncate text-xs text-muted">
                      {a.modality === "online" && <Video size={11} />} {procName(a.procedureId)} · {prof && shortName(prof.name)}
                    </p>
                  </div>
                  <ConfirmBadge status={a.status} confirmation={a.confirmation} />
                  {a.confirmation === "sem_resposta" && (
                    <Button size="sm" variant="outline" onClick={() => toast(`Ligando para ${p?.name} — ${p?.phone} (simulação)`, "info")}><Phone size={12} /> Ligar</Button>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* Horários liberados + lista de espera */}
        <Section icon={RefreshCw} title="Horários liberados → encaixe da lista de espera" subtitle={`${waitlist.length} paciente(s) aguardando um horário. Quando alguém cancela, ofereça a vaga em um clique.`}>
          {freed.length === 0 ? (
            <p className="rounded-lg bg-surface-2 px-3 py-3 text-xs text-muted">Nenhum cancelamento futuro no momento. Dica: envie as confirmações de amanhã. Os cancelamentos aparecem aqui na hora.</p>
          ) : (
            <div className="space-y-2">
              {freed.map((a) => {
                const prof = profOf(a.professionalId);
                const candidates = waitlist.filter((w) => !w.professionalId || w.professionalId === a.professionalId).slice(0, 2);
                return (
                  <div key={a.id} className="rounded-lg border border-border p-2.5">
                    <p className="flex items-center gap-2 text-sm">
                      <XCircle size={14} className="text-danger" />
                      <b>{format(parseISO(a.start), "EEE dd/MM 'às' HH:mm", { locale: ptBR })}</b> · {prof?.name}
                      <span className="ml-auto text-[11px] text-muted">cancelado por {shortName(pat(a.patientId)?.name ?? "")}</span>
                    </p>
                    {candidates.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {candidates.map((w) => (
                          <Button
                            key={w.id}
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const apt = fillSlotFromWaitlist(a.id, w.id);
                              if (apt) toast(`Vaga oferecida e confirmada para ${pat(w.patientId)?.name}`);
                            }}
                          >
                            <CalendarPlus size={12} /> Encaixar {firstLast(pat(w.patientId)?.name ?? "")}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted">Ninguém na lista de espera para este profissional.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Lista de espera</p>
            {waitlist.length === 0 && <p className="text-xs text-muted">Vazia.</p>}
            {waitlist.map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-sm">
                <Clock size={13} className="text-muted" />
                <Link href={`/pacientes/${w.patientId}`} className="shrink-0 whitespace-nowrap font-medium hover:text-primary">{firstLast(pat(w.patientId)?.name ?? "")}</Link>
                <span className="truncate text-xs text-muted">· {procName(w.procedureId)} · {w.professionalId ? shortName(profOf(w.professionalId)?.name ?? "") : "qualquer"} · {w.preferredPeriod}{w.notes ? ` · ${w.notes}` : ""}</span>
                <button className="ml-auto text-muted hover:text-danger cursor-pointer" onClick={() => removeFromWaitlist(w.id)} aria-label="Remover da lista"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </Section>

        {/* Tarefas */}
        <Section
          icon={ListChecks}
          title="Tarefas da equipe"
          subtitle={`${openTasks.length} em aberto`}
          action={<Tabs value={taskScope} onChange={setTaskScope} items={[{ value: "todas", label: "Todas" }, { value: "minhas", label: "Minhas" }]} />}
        >
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {visibleTasks.length === 0 && <p className="py-6 text-center text-sm text-muted">Nenhuma tarefa.</p>}
            {visibleTasks.map((t) => {
              const overdue = !t.done && t.dueDate < today;
              const owner = users.find((u) => u.id === t.assignedUserId);
              return (
                <div key={t.id} className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <button
                    onClick={() => toggleTask(t.id)}
                    className={cn("mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border cursor-pointer", t.done ? "border-primary bg-primary text-primary-fg" : "border-border")}
                    aria-label={t.done ? "Reabrir tarefa" : "Concluir tarefa"}
                  >
                    {t.done && <CheckCircle2 size={12} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", t.done && "text-muted line-through")}>{t.title}</p>
                    <p className="flex items-center gap-2 text-[11px] text-muted">
                      <span className={cn(overdue && "font-semibold text-danger")}>{overdue ? "Atrasada · " : ""}{t.dueDate === today ? "Hoje" : format(parseISO(t.dueDate), "dd/MM")}</span>
                      {t.patientId && <Link href={`/pacientes/${t.patientId}`} className="hover:text-primary">{pat(t.patientId)?.name}</Link>}
                    </p>
                  </div>
                  {owner && <Avatar name={owner.name} size={22} />}
                  <button className="text-muted opacity-0 transition group-hover:opacity-100 hover:text-danger cursor-pointer" onClick={() => deleteTask(t.id)} aria-label="Excluir tarefa"><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Orçamentos parados */}
        <Section icon={FileText} title="Orçamentos sem resposta (3+ dias)" subtitle={`${money(staleBudgets.reduce((s, l) => s + l.estimatedValue, 0))} aguardando decisão do paciente`}>
          <ItemList empty="Nenhum orçamento parado. 👏">
            {staleBudgets.map((l) => (
              <Row
                key={l.id}
                title={l.name}
                sub={`${l.interest} · ${differenceInDays(now, parseISO(l.stageChangedAt))} dias parado`}
                right={<span className="text-sm font-semibold">{money(l.estimatedValue)}</span>}
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (l.conversationId) sendMessage(l.conversationId, `Oi ${l.name.split(" ")[0]}, tudo bem? Conseguiu avaliar a proposta? Se tiver qualquer dúvida sobre valores, reembolso ou horários, estou por aqui 😊`, "atendente");
                      addTask({ title: `Retornar para ${l.name} se não responder ao follow-up`, dueDate: format(addDays(now, 2), "yyyy-MM-dd"), assignedUserId: me?.id, leadId: l.id });
                      mark(`orc-${l.id}`);
                      toast(`Follow-up enviado para ${shortName(l.name)} e lembrete criado para daqui a 2 dias`);
                    }}
                  >
                    <MessageCircle size={12} /> Cobrar retorno
                  </Button>
                }
              />
            ))}
          </ItemList>
        </Section>

        {/* Retornos vencidos */}
        <Section icon={CalendarClock} title="Retornos vencidos" subtitle="Última consulta há mais de 45 dias e nada agendado. Prioriza quem usa receita controlada.">
          <ItemList empty="Nenhum retorno vencido.">
            {returns.map((r) => (
              <Row
                key={r.patient.id}
                title={r.patient.name}
                href={`/pacientes/${r.patient.id}`}
                sub={`Última consulta há ${r.days} dias`}
                badge={r.patient.tags.includes("tag_receita") ? <Badge tone="danger">Receita controlada</Badge> : undefined}
                actions={
                  <>
                    <Button size="sm" variant="outline" onClick={() => remind(r.patient, `ret-${r.patient.id}`, "Convite de retorno enviado")}><Send size={12} /> Convidar</Button>
                    <Button size="sm" onClick={() => setSchedule({ patientId: r.patient.id, procedureId: "proc_retorno" })}><CalendarPlus size={12} /> Agendar</Button>
                  </>
                }
              />
            ))}
          </ItemList>
        </Section>

        {/* Tratamentos interrompidos */}
        <Section icon={HeartPulse} title="Tratamentos interrompidos" subtitle="Pacientes que pararam no meio do plano de tratamento. É receita já vendida e cuidado incompleto.">
          <ItemList empty="Nenhum tratamento parado.">
            {stalled.map((pl) => {
              const pr = progress[pl.id];
              const p = pat(pl.patientId);
              return (
                <Row
                  key={pl.id}
                  title={p?.name ?? ""}
                  href={`/pacientes/${pl.patientId}?tab=tratamento`}
                  sub={`${pl.title} · ${pr.done}/${pl.totalSessions} sessões · parado há ${pr.daysSinceLast} dias`}
                  right={<span className="text-xs font-semibold text-warning">{money(pr.remainingValue)}</span>}
                  actions={
                    <>
                      <Button size="sm" variant="outline" onClick={() => remind(p, `plan-${pl.id}`, "Mensagem de retomada enviada")}><Send size={12} /> Retomar</Button>
                      <Button size="sm" onClick={() => setSchedule({ patientId: pl.patientId, procedureId: pl.procedureId, professionalId: pl.professionalId })}><CalendarPlus size={12} /> Agendar</Button>
                    </>
                  }
                />
              );
            })}
          </ItemList>
        </Section>

        {/* Aniversariantes */}
        <Section icon={Cake} title="Aniversariantes da semana" subtitle="Um carinho que fortalece o vínculo com a clínica">
          <ItemList empty="Nenhum aniversariante nos próximos 7 dias.">
            {birthdays.map(({ p, next, days }) => (
              <Row
                key={p.id}
                title={p.name}
                href={`/pacientes/${p.id}`}
                sub={days === 0 ? "🎉 Hoje!" : `${format(next, "EEEE, dd/MM", { locale: ptBR })} · em ${days} dia(s)`}
                actions={<Button size="sm" variant="outline" onClick={() => remind(p, `bday-${p.id}`, "Mensagem de parabéns enviada")}><Gift size={12} /> Parabéns</Button>}
              />
            ))}
          </ItemList>
        </Section>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted"><AlertTriangle size={12} /> Envios pelo WhatsApp são simulados neste protótipo. Na versão real eles saem pela Evolution API.</p>

      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} />
      <WaitlistModal open={waitOpen} onClose={() => setWaitOpen(false)} />
      <AppointmentFormModal
        open={!!schedule}
        onClose={() => setSchedule(null)}
        patientId={schedule?.patientId}
        procedureId={schedule?.procedureId}
        professionalId={schedule?.professionalId}
        onSaved={() => schedule && mark(`ret-${schedule.patientId}`)}
      />
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, action, children }: { icon: typeof Cake; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 px-5 pt-4 pb-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-strong"><Icon size={16} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold first-letter:uppercase">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 px-5 pb-4">{children}</div>
    </Card>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "neutral" | "info" | "success" | "warning" }) {
  const c = { neutral: "bg-surface-2 text-fg", info: "bg-info-soft text-info", success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning" }[tone];
  return (
    <div className={cn("rounded-lg px-2 py-1.5", c)}>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] font-medium">{label}</p>
    </div>
  );
}

function ConfirmBadge({ status, confirmation }: { status: string; confirmation?: string }) {
  if (status === "cancelado" || confirmation === "cancelou") return <Badge tone="danger">Cancelou</Badge>;
  if (confirmation === "confirmou" || status === "confirmado") return <Badge tone="success">✓ Confirmou</Badge>;
  if (confirmation === "enviada") return <Badge tone="info"><span className="animate-pulse">Aguardando…</span></Badge>;
  if (confirmation === "sem_resposta") return <Badge tone="warning">Sem resposta</Badge>;
  return <Badge>Não enviada</Badge>;
}

function ItemList({ children, empty }: { children: React.ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children];
  if (arr.filter(Boolean).length === 0) return <Empty title={empty} />;
  return <div className="divide-y divide-border">{children}</div>;
}

function Row({ title, sub, href, badge, right, actions }: { title: string; sub: string; href?: string; badge?: React.ReactNode; right?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {href ? <Link href={href} className="truncate text-sm font-medium hover:text-primary">{title}</Link> : <p className="truncate text-sm font-medium">{title}</p>}
          {badge}
        </div>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      {right}
      <div className="flex gap-1.5">{actions}</div>
    </div>
  );
}
