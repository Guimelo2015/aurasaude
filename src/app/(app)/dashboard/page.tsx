"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, CalendarCheck, CalendarDays, DollarSign, Megaphone, TrendingUp, UserPlus, UserX, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Field, Modal, Select, Textarea, toast } from "@/components/ui";
import { PatientFormModal } from "@/components/forms/patient-form";
import { useApp, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/permissions";
import { channelVolume, openBudgetsByAge, stalledMoney, todayKpis } from "@/lib/metrics";
import { useRouter } from "next/navigation";
import { openCampaignDraft } from "@/lib/campaign-draft";
import { useOrganize } from "@/lib/use-organize";
import { APT_STATUS } from "@/lib/labels";
import { capitalizeFirst, cn, money, moneyCompact, pct } from "@/lib/utils";
import { tooltipStyle } from "@/components/chart-theme";

const CHANNEL_COLORS: Record<string, string> = { "Tráfego pago": "#3b82f6", Indicação: "#0f9d8f", Orgânico: "#d9469f" };

export default function DashboardPage() {
  const user = useCurrentUser();
  const allApts = useApp((s) => s.appointments);
  const leads = useApp((s) => s.leads);
  const patients = useApp((s) => s.patients);
  const procedures = useApp((s) => s.procedures);
  const professionals = useApp((s) => s.professionals);
  const conversations = useApp((s) => s.conversations);
  const aiName = useApp((s) => s.aiConfig.name);
  const [patientOpen, setPatientOpen] = useState(false);
  const router = useRouter();

  const showMoney = can(user?.role, "financeiro.view");
  const isProf = user?.role === "profissional";
  const appointments = isProf ? allApts.filter((a) => a.professionalId === user?.professionalId) : allApts;

  const k = useMemo(() => todayKpis(appointments, leads), [appointments, leads]);
  const allBudgets = useApp((s) => s.budgets);
  const allPatients = useApp((s) => s.patients);
  const allPlans = useApp((s) => s.plans);
  const procs = useApp((s) => s.procedures);
  const { progress, status } = useOrganize();
  // mesma regra do relatório "Dinheiro parado" (sem dupla contagem)
  const stalled = useMemo(
    () => stalledMoney({ patients: allPatients, appointments: allApts, leads, budgets: allBudgets, plans: allPlans, procedures: procs }, status, progress),
    [allPatients, allApts, leads, allBudgets, allPlans, procs, status, progress],
  );
  const channels = useMemo(() => channelVolume(leads, 30), [leads]);
  const budgets = useMemo(() => openBudgetsByAge(leads), [leads]);
  const moneyOnTable = budgets.reduce((s, b) => s + b.orcamento + b.qualificacao, 0);
  const todayList = appointments
    .filter((a) => isSameDay(parseISO(a.start), new Date()) && a.status !== "cancelado")
    .sort((a, b) => a.start.localeCompare(b.start));
  const iaActive = conversations.filter((c) => c.handler === "ia").length;
  const waitingHuman = conversations.filter((c) => c.queue === "novo").length;
  const urgent = conversations.filter((c) => c.queue === "novo" && c.handoff?.urgency === "alta");

  const hello = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{hello}, {user?.name.split(" ").slice(0, 2).join(" ")} 👋</h1>
          <p className="text-sm text-muted">{capitalizeFirst(format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR }))} · visão geral da clínica</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user?.role, "pacientes.edit") && <Button variant="outline" onClick={() => setPatientOpen(true)}><UserPlus size={15} /> Cadastrar paciente</Button>}
          <Link href="/agenda"><Button variant="outline"><CalendarDays size={15} /> Ver agenda</Button></Link>
          {can(user?.role, "campanhas.edit") && <Button onClick={() => openCampaignDraft(router.push, {})}><Megaphone size={15} /> Disparar campanha</Button>}
        </div>
      </div>

      {urgent.length > 0 && !isProf && (
        <Link href={`/atendimento?c=${urgent[0].id}`} className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm transition hover:brightness-95">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" /></span>
          <span><b>{urgent.length} paciente(s) com urgência</b> aguardando atendimento humano — {urgent.map((u) => u.contactName).join(", ")}</span>
          <span className="ml-auto text-xs font-medium text-danger">Atender agora →</span>
        </Link>
      )}

      {showMoney && (
        <Link href="/relatorios" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 px-4 py-3 text-sm transition hover:brightness-95">
          <span className="text-lg">💰</span>
          <span>
            <b>{money(stalled.total)}</b> parados: {stalled.groups.map((g) => `${g.items.length} ${g.title.toLowerCase()}`).join(" · ")}
          </span>
          <span className="ml-auto text-xs font-medium text-warning">Ver e recuperar →</span>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={CalendarCheck} tone="primary" label="Confirmados hoje" value={`${k.confirmed}`} sub={`de ${k.totalToday} agendamentos do dia`} />
        {showMoney ? (
          <Kpi icon={DollarSign} tone="success" label="Faturamento do dia" value={money(k.realized)} sub={`Previsto: ${money(k.forecast)}`} progress={k.forecast ? k.realized / k.forecast : 0} />
        ) : (
          <Kpi icon={Users} tone="success" label="Atendidos hoje" value={`${todayList.filter((a) => a.status === "compareceu").length}`} sub={`${todayList.length} pacientes na agenda`} />
        )}
        <Kpi icon={TrendingUp} tone="info" label="Novos leads (24h)" value={`${k.newLeads}`} sub={`${iaActive} em triagem com ${aiName} · ${waitingHuman} aguardando`} />
        <Kpi icon={UserX} tone="danger" label="Taxa de faltas hoje" value={pct(k.noShowRate)} sub={`${k.noShows} falta(s) registradas`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Volume por canal */}
        {!isProf && (
          <Card>
            <CardHeader title="Volume de atendimento por canal" subtitle="Leads recebidos nos últimos 30 dias" />
            <div className="flex items-center gap-2 px-3 pb-4">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={channels.groups} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                      {channels.groups.map((g) => <Cell key={g.name} fill={CHANNEL_COLORS[g.name]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2.5 pr-2">
                {channels.groups.map((g) => {
                  const total = channels.groups.reduce((s, x) => s + x.value, 0) || 1;
                  return (
                    <div key={g.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_COLORS[g.name] }} />{g.name}</span>
                        <span className="font-semibold">{g.value}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(g.value / total) * 100}%`, background: CHANNEL_COLORS[g.name] }} /></div>
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] text-muted">Pago = Meta Ads + Google · Orgânico = Instagram, Site, Passante</p>
              </div>
            </div>
          </Card>
        )}

        {/* Dinheiro na mesa */}
        {!isProf && (
          <Card className="xl:col-span-2">
            <CardHeader
              title="Negociações abertas no funil"
              subtitle="Leads em Qualificação + Orçamento enviado, pelo tempo parado na etapa. Quanto mais à direita, maior o risco de perda. (Não é o mesmo que Dinheiro parado: aqui entra também quem ainda está sendo qualificado.)"
              action={<Badge tone="warning" className="text-xs">{moneyCompact(moneyOnTable)} em negociação</Badge>}
            />
            <div className="h-56 px-2 pb-3">
              <ResponsiveContainer>
                <BarChart data={budgets} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => moneyCompact(v)} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Bar dataKey="orcamento" name="Orçamento enviado" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="qualificacao" name="Em qualificação" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Agenda do dia */}
        <Card className={cn(isProf ? "xl:col-span-2" : "xl:col-span-2")}>
          <CardHeader title={isProf ? "Seus pacientes de hoje" : "Agenda de hoje"} subtitle={`${todayList.length} agendamentos`} action={<Link href="/agenda" className="text-xs font-medium text-primary">Abrir agenda →</Link>} />
          <div className="max-h-80 divide-y divide-border overflow-y-auto px-2 pb-2">
            {todayList.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhum agendamento hoje.</p>}
            {todayList.map((a) => {
              const p = patients.find((x) => x.id === a.patientId);
              const prof = professionals.find((x) => x.id === a.professionalId);
              return (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-12 text-sm font-semibold tabular-nums">{format(parseISO(a.start), "HH:mm")}</span>
                  <span className="h-8 w-1 rounded-full" style={{ background: prof?.color }} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/pacientes/${p?.id}`} className="block truncate text-sm font-medium hover:text-primary">{p?.name}</Link>
                    <p className="truncate text-xs text-muted">{procedures.find((x) => x.id === a.procedureId)?.name} · {prof?.name}</p>
                  </div>
                  {showMoney && <span className="hidden text-xs text-muted sm:block">{money(a.value)}</span>}
                  <Badge tone={APT_STATUS[a.status].tone}>{APT_STATUS[a.status].label}</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        {/* IA */}
        {!isProf && (
          <Card>
            <CardHeader title={`Agente ${aiName} (IA)`} subtitle="Triagem automática no WhatsApp" action={<Bot size={18} className="text-violet" />} />
            <div className="space-y-3 px-5 pb-5">
              <AiStat label="Conversas em triagem agora" value={iaActive} />
              <AiStat label="Aguardando atendente (com card)" value={waitingHuman} />
              <AiStat label="Leads recebidos nos últimos 30 dias" value={channels.groups.reduce((s, g) => s + g.value, 0)} />
              <div className="rounded-lg bg-violet-soft px-3 py-2.5 text-xs leading-relaxed">
                A {aiName} responde em segundos, 24h por dia, e entrega o lead para a recepção com interesse, convênio, urgência e melhor horário.
              </div>
              <Link href="/atendimento"><Button variant="outline" size="sm" className="w-full justify-center">Ir para o atendimento</Button></Link>
            </div>
          </Card>
        )}
      </div>

      <PatientFormModal open={patientOpen} onClose={() => setPatientOpen(false)} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone, progress }: { icon: typeof Bot; label: string; value: string; sub: string; tone: "primary" | "success" | "info" | "danger"; progress?: number }) {
  const bg = { primary: "bg-primary-soft text-primary-strong", success: "bg-success-soft text-success", info: "bg-info-soft text-info", danger: "bg-danger-soft text-danger" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className={cn("grid h-8 w-8 place-items-center rounded-lg", bg)}><Icon size={16} /></span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
      )}
    </Card>
  );
}

function AiStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
