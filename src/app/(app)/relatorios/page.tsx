"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight, Download, Megaphone } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, PageHeader, Select, Tabs, toast } from "@/components/ui";
import { useOrganize } from "@/lib/use-organize";
import { axisTick, tooltipStyle } from "@/components/chart-theme";
import { useApp } from "@/lib/store";
import {
  conversionByChannel,
  financialSummary,
  inactivePatients,
  lostSales,
  monthlyRevenue,
  noShowsByMonth,
  noShowsByProfessional,
  periodRange,
  previousComparableRange,
  stalledMoney,
  teamStats,
  type Period,
  type StalledGroup,
} from "@/lib/metrics";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/store";
import { can } from "@/lib/permissions";
import { openCampaignDraft } from "@/lib/campaign-draft";
import { RECOVERABLE_WINDOW_DAYS } from "@/lib/campaigns";
import { cn, fmtDate, maskPhone, money, moneyCompact, pct } from "@/lib/utils";

type Report = "parado" | "perdidas" | "equipe" | "inatividade" | "financeiro" | "faturamento" | "faltas" | "conversao";

function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function RelatoriosPage() {
  const [tab, setTab] = useState<Report>("parado");
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeader title="Relatórios" subtitle="Dados essenciais para a tomada de decisão da clínica" />
      <div className="overflow-x-auto">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "parado", label: "💰 Dinheiro parado" },
            { value: "perdidas", label: "Vendas perdidas" },
            { value: "equipe", label: "Equipe" },
            { value: "inatividade", label: "Clientes ausentes" },
            { value: "financeiro", label: "Financeiro" },
            { value: "faturamento", label: "Faturamento mês a mês" },
            { value: "faltas", label: "Faltas (no-show)" },
            { value: "conversao", label: "Conversão por canal" },
          ]}
        />
      </div>
      {tab === "parado" && <DinheiroParado />}
      {tab === "perdidas" && <VendasPerdidas />}
      {tab === "equipe" && <Equipe />}
      {tab === "inatividade" && <Inatividade />}
      {tab === "financeiro" && <Financeiro />}
      {tab === "faturamento" && <Faturamento />}
      {tab === "faltas" && <Faltas />}
      {tab === "conversao" && <Conversao />}
    </div>
  );
}

// ---------------------------------------------------------------
const GROUP_COLOR: Record<StalledGroup["key"], string> = { plans: "#f59e0b", budgets: "#8b5cf6", noshow: "#3b82f6", risk: "#dc3b3b" };
const GROUP_MSG: Record<StalledGroup["key"], string> = {
  plans: "Oi {{nome}}, aqui é do {{clinica}} 💚 Sentimos sua falta nas sessões e queremos te ajudar a dar continuidade ao seu tratamento. Vamos encontrar um horário que funcione pra você? Para não receber mais mensagens, responda SAIR.",
  budgets: "Oi {{nome}}! Aqui é do {{clinica}}. Ficou alguma dúvida sobre a proposta, valores, reembolso ou horários? Estou por aqui pra te ajudar 😊 (responda SAIR para não receber mais mensagens)",
  noshow: "Oi {{nome}}, aqui é do {{clinica}}. Sentimos sua falta na última consulta e está tudo bem, imprevistos acontecem 💚 Quer que a gente encontre um novo horário? Para não receber mais mensagens, responda SAIR.",
  risk: "Oi {{nome}}, aqui é do {{clinica}} 💚 Sua última consulta foi em {{data}} e queremos saber como você está. Se fizer sentido retomar o acompanhamento, responda aqui. Para não receber mais mensagens, responda SAIR.",
};

function DinheiroParado() {
  const patients = useApp((s) => s.patients);
  const appointments = useApp((s) => s.appointments);
  const leads = useApp((s) => s.leads);
  const budgets = useApp((s) => s.budgets);
  const plans = useApp((s) => s.plans);
  const procedures = useApp((s) => s.procedures);
  const { progress, status } = useOrganize();
  const router = useRouter();
  const canCampaign = can(useCurrentUser()?.role, "campanhas.edit");
  const [open, setOpen] = useState<StalledGroup["key"]>("plans");

  const { groups, total } = useMemo(
    () => stalledMoney({ patients, appointments, leads, budgets, plans, procedures }, status, progress),
    [patients, appointments, leads, budgets, plans, procedures, status, progress],
  );
  const current = groups.find((g) => g.key === open)!;

  const recover = (g: StalledGroup) =>
    openCampaignDraft(router.push, {
      name: `Recuperação · ${g.title}`,
      description: `Gerada pelo relatório Dinheiro parado (${money(g.value)} em ${g.items.length} contatos).`,
      channel: "whatsapp",
      audience: "lista_manual",
      manualTargets: g.items.map((i) => i.targetId),
      messages: [{ text: GROUP_MSG[g.key] }],
    });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 bg-gradient-to-r from-[#0b7d72] to-[#0f9d8f] p-6 text-white">
          <div>
            <p className="text-sm text-white/80">Dinheiro parado na clínica agora</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{money(total)}</p>
            <p className="mt-1 max-w-xl text-sm text-white/80">Soma de 4 grupos. Cada paciente entra em <b>um único grupo</b>, na ordem de prioridade abaixo, para não contar o mesmo dinheiro duas vezes.</p>
          </div>
          <div className="ml-auto flex h-3 w-full max-w-md overflow-hidden rounded-full bg-white/20">
            {groups.map((g) => <div key={g.key} style={{ width: `${(g.value / (total || 1)) * 100}%`, background: GROUP_COLOR[g.key] }} title={g.title} />)}
          </div>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((g, i) => (
          <Card key={g.key} className={cn("cursor-pointer p-4 transition", open === g.key ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40")} onClick={() => setOpen(g.key)}>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLOR[g.key] }} />
              <p className="text-xs font-medium text-muted">{i + 1}º · {g.title}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{moneyCompact(g.value)}</p>
            <p className="text-xs text-muted">{g.items.length} contatos · {g.rule}</p>
            {canCampaign && (
              <Button size="sm" className="mt-3 w-full justify-center" disabled={!g.items.length} onClick={(e) => { e.stopPropagation(); recover(g); }}>
                <Megaphone size={13} /> Recuperar com campanha
              </Button>
            )}
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title={current.title} subtitle={`Conta: ${current.rule} · total ${money(current.value)}`} />
        <Table
          head={["Nome", "Situação", "Valor"]}
          rows={current.items.slice(0, 25).map((it) => [
            it.href ? <Link key="n" href={it.href} className="font-medium hover:text-primary">{it.name}</Link> : <span key="n" className="font-medium">{it.name}</span>,
            it.detail,
            <b key="v">{money(it.value)}</b>,
          ])}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
function VendasPerdidas() {
  const leads = useApp((s) => s.leads);
  const users = useApp((s) => s.users);
  const router = useRouter();
  const canCampaign = can(useCurrentUser()?.role, "campanhas.edit");
  const [days, setDays] = useState(180);
  const d = useMemo(() => lostSales(leads, users, days), [leads, users, days]);

  const recoverAll = () =>
    openCampaignDraft(router.push, {
      name: "Recuperação de vendas perdidas",
      description: `Leads perdidos há até ${RECOVERABLE_WINDOW_DAYS} dias por preço, horário ou falta de resposta.`,
      channel: "whatsapp",
      audience: "lista_manual",
      manualTargets: d.recuperaveis.map((l) => l.id),
      messages: [{ text: "Oi {{nome}}, tudo bem? Aqui é do {{clinica}} 💚 Há um tempo você falou com a gente e queríamos saber se ainda podemos te ajudar. Temos novos horários (presenciais e online), parcelamento e nota para reembolso. Se não quiser mais receber mensagens, responda SAIR." }],
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Leads que chegaram ao fim do funil sem fechar, e quanto disso ainda dá para recuperar</p>
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-40 text-xs">
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={180}>Últimos 6 meses</option>
        </Select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Vendas perdidas" value={`${d.perdidos}`} sub={`${d.ganhos} ganhas no mesmo período`} tone="danger" />
        <Stat label="Taxa de perda" value={pct(d.taxaPerda)} sub="perdidos ÷ (perdidos + ganhos)" />
        <Stat label="Valor perdido" value={moneyCompact(d.valorPerdido)} sub="soma do valor estimado dos leads perdidos" tone="danger" />
        <Stat label="Recuperável" value={moneyCompact(d.valorRecuperavel)} sub={`${d.recuperaveis.length} leads · já recuperados por campanha: ${d.recuperados.length}`} tone="success" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Por motivo da perda"
            subtitle={`Recuperável = perdido há até ${RECOVERABLE_WINDOW_DAYS} dias por preço, horário ou falta de resposta`}
            action={canCampaign && d.recuperaveis.length > 0 && <Button size="sm" onClick={recoverAll}><Megaphone size={13} /> Recuperar {d.recuperaveis.length}</Button>}
          />
          <Table
            head={["Motivo", "Leads", "Valor", ""]}
            rows={d.porMotivo.map((m) => [m.motivo, m.qtd, money(m.valor), m.recuperavel ? <Badge key="b" tone="success">Recuperável</Badge> : <Badge key="b">Desinteresse</Badge>])}
          />
        </Card>
        <Card>
          <CardHeader title="Por canal de origem" subtitle="Onde se perde mais" />
          <Table
            head={["Canal", "Perdidos", "Ganhos", "Taxa de perda", "Valor perdido"]}
            rows={d.porCanal.map((c) => [c.key, c.perdidos, c.ganhos, pct(c.taxaPerda), money(c.valor)])}
          />
        </Card>
      </div>
      <Card>
        <CardHeader title="Por atendente" subtitle="Perdas do período por responsável pelo lead" />
        <Table head={["Atendente", "Perdidos", "Ganhos", "Taxa de perda", "Valor perdido"]} rows={d.porAtendente.map((a) => [a.nome, a.perdidos, a.ganhos, pct(a.taxaPerda), money(a.valor)])} />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
function Equipe() {
  const leads = useApp((s) => s.leads);
  const users = useApp((s) => s.users);
  const [days, setDays] = useState(90);
  const data = useMemo(() => teamStats(leads, users, days), [leads, users, days]);
  const best = data[0];
  const fastest = [...data].sort((a, b) => a.tempoResposta - b.tempoResposta)[0];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Desempenho da recepção no atendimento de novos pacientes</p>
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-40 text-xs">
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
          <option value={180}>Últimos 6 meses</option>
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((d, i) => (
          <Card key={d.user.id} className={cn("p-5", i === 0 && "border-primary/40")}>
            <div className="flex items-center gap-3">
              <Avatar name={d.user.name} size={44} />
              <div className="flex-1">
                <p className="font-semibold">{i === 0 ? "🥇 " : "🥈 "}{d.user.name}</p>
                <p className="text-xs text-muted">{d.atendimentos} leads · {d.convertidos} ganhos · {d.perdidos} perdidos · {d.abertos} em andamento</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold">{money(d.receita)}</p>
                <p className="text-xs text-muted">receita realizada</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
              <div><p className="text-lg font-semibold">{pct(d.taxa)}</p><p className="text-[11px] text-muted">Conversão (ganhos ÷ decididos)</p></div>
              <div><p className={cn("text-lg font-semibold", d.tempoResposta <= 10 ? "text-success" : "text-warning")}>{Math.round(d.tempoResposta)} min</p><p className="text-[11px] text-muted">1ª resposta (média)</p></div>
              <div><p className="text-lg font-semibold">{d.convertidos}</p><p className="text-[11px] text-muted">Agendaram</p></div>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Conversão × tempo de resposta" subtitle="Quem responde mais rápido tende a converter mais" />
        <div className="h-64 px-2 pb-4">
          <ResponsiveContainer>
            <BarChart data={data.map((d) => ({ nome: d.user.name.split(" ")[0], conversao: Math.round(d.taxa * 1000) / 10, resposta: Math.round(d.tempoResposta) }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="nome" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="conversao" name="Conversão (%)" fill="#0f9d8f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resposta" name="1ª resposta (min)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      {best && fastest && (
        <Card className="p-4 text-sm">
          💡 <b>{fastest.user.name.split(" ")[0]}</b> responde em média em {Math.round(fastest.tempoResposta)} min
          {best.user.id === fastest.user.id ? " e lidera a conversão." : "."} Lead respondido em até 5 minutos tem muito mais chance de agendar, e a IA garante resposta imediata 24h enquanto a equipe assume.
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
function Inatividade() {
  const patients = useApp((s) => s.patients);
  const appointments = useApp((s) => s.appointments);
  const procedures = useApp((s) => s.procedures);
  const [months, setMonths] = useState(6);
  const router = useRouter();
  const canCampaign = can(useCurrentUser()?.role, "campanhas.edit");
  const list = useMemo(() => inactivePatients(patients, appointments, months), [patients, appointments, months]);
  const lastProc = (pid: string) => {
    const a = appointments.filter((x) => x.patientId === pid && x.status === "compareceu").sort((x, y) => y.start.localeCompare(x.start))[0];
    return procedures.find((p) => p.id === a?.procedureId)?.name ?? "—";
  };
  return (
    <Card>
      <CardHeader
        title="Relatório de clientes ausentes (inatividade)"
        subtitle={`${list.length} pacientes sem retorno há mais de ${months} meses e sem agendamento futuro — ideal para campanhas de retorno e de continuidade do tratamento`}
        action={
          <div className="flex gap-2">
            <Select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="h-8 w-32 text-xs">
              {[3, 6, 9, 12].map((m) => <option key={m} value={m}>+{m} meses</option>)}
            </Select>
            <Button size="sm" variant="outline" onClick={() => downloadCSV("pacientes-inativos", [["Nome", "WhatsApp", "E-mail", "Convênio", "Última visita", "Meses ausente", "Último procedimento"], ...list.map((r) => [r.patient.name, maskPhone(r.patient.phone), r.patient.email, r.patient.insurance, fmtDate(r.lastVisit), r.monthsAway, lastProc(r.patient.id)])])}>
              <Download size={13} /> CSV
            </Button>
            {canCampaign && (
              <Button size="sm" disabled={!list.length} onClick={() => openCampaignDraft(router.push, { name: `Retorno de pacientes ausentes (+${months} meses)`, channel: "whatsapp", audience: "lista_manual", manualTargets: list.map((r) => r.patient.id), messages: [{ text: GROUP_MSG.risk }] })}>
                <Megaphone size={13} /> Campanha
              </Button>
            )}
          </div>
        }
      />
      <Table
        head={["Paciente", "WhatsApp", "Convênio", "Última visita", "Ausente há", "Último procedimento"]}
        rows={list.slice(0, 100).map((r) => [
          <Link key="n" href={`/pacientes/${r.patient.id}`} className="font-medium hover:text-primary">{r.patient.name}</Link>,
          maskPhone(r.patient.phone),
          r.patient.insurance,
          fmtDate(r.lastVisit),
          <Badge key="b" tone={r.monthsAway >= 12 ? "danger" : "warning"}>{r.monthsAway} meses</Badge>,
          lastProc(r.patient.id),
        ])}
      />
    </Card>
  );
}

// ---------------------------------------------------------------
function Financeiro() {
  const transactions = useApp((s) => s.transactions);
  const [period, setPeriod] = useState<Period>("mes");
  const [offset, setOffset] = useState(0);
  const range = periodRange(period, offset);
  const prevRange = previousComparableRange(period, offset);
  const f = useMemo(() => financialSummary(transactions, range.start, range.end), [transactions, range.start, range.end]);
  const prev = useMemo(() => financialSummary(transactions, prevRange.start, prevRange.end), [transactions, prevRange.start, prevRange.end]);
  const delta = prev.bruto ? (f.bruto - prev.bruto) / prev.bruto : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={period} onChange={(v) => { setPeriod(v); setOffset(0); }} items={[{ value: "dia", label: "Diário" }, { value: "semana", label: "Semanal" }, { value: "mes", label: "Mensal" }]} />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => o - 1)} aria-label="Anterior"><ChevronLeft size={14} /></Button>
          <span className="min-w-44 text-center text-sm font-medium capitalize">{range.label}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} aria-label="Próximo"><ChevronRight size={14} /></Button>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadCSV(`financeiro-${range.label}`, [["Data", "Tipo", "Categoria", "Descrição", "Forma", "Valor"], ...f.lancamentos.map((t) => [fmtDate(t.date, "dd/MM/yyyy HH:mm"), t.type, t.category, t.description, t.method, t.amount.toFixed(2).replace(".", ",")])])}>
          <Download size={13} /> CSV
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faturamento bruto" value={money(f.bruto)} sub={<span className={delta >= 0 ? "text-success" : "text-danger"}>{delta >= 0 ? "▲" : "▼"} {pct(Math.abs(delta))} vs. {offset === 0 && period !== "dia" ? "mesmo período anterior" : "período anterior"}</span>} />
        <Stat label="Saídas" value={money(f.saidas)} sub={`${f.saidasPorCategoria.length} categorias`} />
        <Stat label="Resultado líquido" value={money(f.liquido)} sub={f.bruto ? `Margem ${pct(f.liquido / f.bruto)}` : "—"} tone={f.liquido >= 0 ? "success" : "danger"} />
        <Stat label="Ticket médio" value={money(f.ticketMedio)} sub={`${f.atendimentos} atendimentos pagos`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Entradas por categoria" />
          <BarsList data={f.entradasPorCategoria.map((x) => ({ label: x.categoria, value: x.valor }))} color="var(--success)" />
        </Card>
        <Card>
          <CardHeader title="Saídas por categoria" />
          <BarsList data={f.saidasPorCategoria.map((x) => ({ label: x.categoria, value: x.valor }))} color="var(--danger)" />
        </Card>
        <Card>
          <CardHeader title="Entradas por forma de pagamento" />
          <BarsList data={f.porMetodo.map((x) => ({ label: x.metodo, value: x.valor }))} color="var(--primary)" />
        </Card>
      </div>
      <Card>
        <CardHeader title="Lançamentos" subtitle={`${f.lancamentos.length} no período`} />
        <Table
          head={["Data", "Descrição", "Categoria", "Forma", "Valor"]}
          rows={f.lancamentos.slice(0, 80).map((t) => [
            fmtDate(t.date, "dd/MM HH:mm"),
            t.description,
            t.category,
            t.method,
            <span key="v" className={cn("font-medium", t.type === "entrada" ? "text-success" : "text-danger")}>{t.type === "entrada" ? "+" : "−"} {money(t.amount)}</span>,
          ])}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
function Faturamento() {
  const transactions = useApp((s) => s.transactions);
  const data = useMemo(() => monthlyRevenue(transactions, 12), [transactions]);
  const withVar = data;
  const closed = data.filter((d) => !d.parcial);
  const best = [...closed].sort((a, b) => b.entradas - a.entradas)[0];
  const total = data.reduce((s, d) => s + d.entradas, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Faturamento 12 meses" value={moneyCompact(total)} sub={`Média ${money(closed.reduce((s, d) => s + d.entradas, 0) / (closed.length || 1))}/mês (meses fechados)`} />
        <Stat label="Melhor mês" value={best?.mes ?? "—"} sub={best ? money(best.entradas) : ""} />
        <Stat label="Lucro 12 meses" value={moneyCompact(data.reduce((s, d) => s + d.lucro, 0))} sub="Entradas − saídas" tone="success" />
      </div>
      <Card>
        <CardHeader title="Comparativo de desempenho mês a mês" subtitle="Entradas, saídas e resultado" action={<Button size="sm" variant="outline" onClick={() => downloadCSV("faturamento-mensal", [["Mês", "Entradas", "Saídas", "Lucro", "Variação"], ...withVar.map((d) => [d.mes, d.entradas, d.saidas, d.lucro, pct(d.variacao)])])}><Download size={13} /> CSV</Button>} />
        <div className="h-80 px-2 pb-4">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => moneyCompact(v)} tick={axisTick} axisLine={false} tickLine={false} width={70} />
              <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="entradas" name="Entradas" fill="#0f9d8f" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#f2a1a1" radius={[4, 4, 0, 0]} />
              <Line dataKey="lucro" name="Lucro" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <p className="px-5 pt-4 text-[11px] text-muted">* Mês corrente (parcial): variação contra o mesmo período do mês anterior (dia 1 até hoje).</p>
        <Table
          head={["Mês", "Entradas", "Saídas", "Lucro", "Variação"]}
          rows={[...withVar].reverse().map((d) => [
            <span key="m" className="capitalize">{d.mes}{d.parcial && <span className="ml-1 text-[10px] normal-case text-muted">(parcial)</span>}</span>,
            money(d.entradas),
            money(d.saidas),
            <span key="l" className={d.lucro >= 0 ? "text-success" : "text-danger"}>{money(d.lucro)}</span>,
            <span key="v" className={d.variacao >= 0 ? "text-success" : "text-danger"} title={d.parcial ? "Comparado com o mesmo período do mês anterior" : "Comparado com o mês anterior"}>{d.variacao >= 0 ? "▲" : "▼"} {pct(Math.abs(d.variacao))}{d.parcial && <span className="text-muted"> *</span>}</span>,
          ])}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
function Faltas() {
  const appointments = useApp((s) => s.appointments);
  const professionals = useApp((s) => s.professionals);
  const [period, setPeriod] = useState<Period>("mes");
  const [offset, setOffset] = useState(0);
  const range = periodRange(period, offset);
  const byProf = useMemo(() => noShowsByProfessional(appointments, professionals, range.start, range.end), [appointments, professionals, range.start, range.end]);
  const trend = useMemo(() => noShowsByMonth(appointments, 6), [appointments]);
  const total = byProf.reduce((s, p) => s + p.faltas, 0);
  const totalApts = byProf.reduce((s, p) => s + p.total, 0);
  const loss = byProf.reduce((s, p) => s + p.perda, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={period} onChange={(v) => { setPeriod(v); setOffset(0); }} items={[{ value: "semana", label: "Semana" }, { value: "mes", label: "Mês" }]} />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => o - 1)} aria-label="Anterior"><ChevronLeft size={14} /></Button>
          <span className="min-w-44 text-center text-sm font-medium capitalize">{range.label}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0} aria-label="Próximo"><ChevronRight size={14} /></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Consultas perdidas" value={`${total}`} sub={`de ${totalApts} atendimentos previstos`} tone="danger" />
        <Stat label="Taxa de no-show" value={pct(totalApts ? total / totalApts : 0)} sub="Referência saudável: abaixo de 10%" />
        <Stat label="Receita perdida" value={money(loss)} sub="Valor das consultas não realizadas" tone="danger" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Faltas por profissional" subtitle="Quem mais sofre com ausências" />
          <div className="space-y-4 px-5 pb-5">
            {[...byProf].sort((a, b) => b.taxa - a.taxa).map((p) => (
              <div key={p.profissional}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.cor }} />{p.profissional}</span>
                  <span className="text-xs text-muted"><b className="text-fg">{p.faltas}</b> faltas / {p.total} · <b className={p.taxa > 0.12 ? "text-danger" : "text-fg"}>{pct(p.taxa)}</b></span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-danger/80" style={{ width: `${Math.min(100, p.taxa * 400)}%` }} /></div>
                <p className="mt-1 text-[11px] text-muted">Receita perdida: {money(p.perda)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Evolução da taxa de faltas" subtitle="Últimos 6 meses" />
          <div className="h-64 px-2 pb-4">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gFaltas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#dc3b3b" stopOpacity={0.3} />
                    <stop offset="1" stopColor="#dc3b3b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => pct(v)} tick={axisTick} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v, n) => (n === "taxa" ? pct(Number(v)) : v)} contentStyle={tooltipStyle} />
                <Area dataKey="taxa" name="taxa" stroke="#dc3b3b" fill="url(#gFaltas)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
function Conversao() {
  const leads = useApp((s) => s.leads);
  const [days, setDays] = useState(180);
  const data = useMemo(() => conversionByChannel(leads, days), [leads, days]);
  const totalLeads = data.reduce((s, d) => s + d.leads, 0);
  const totalWon = data.reduce((s, d) => s + d.convertidos, 0);
  const totalLost = data.reduce((s, d) => s + d.perdidos, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Leads no período" value={`${totalLeads}`} sub={`Últimos ${days} dias`} />
        <Stat label="Pacientes que fecharam" value={`${totalWon}`} sub="Agendados ou realizados" tone="success" />
        <Stat label="Conversão geral" value={pct(totalWon + totalLost ? totalWon / (totalWon + totalLost) : 0)} sub={`ganhos ÷ (ganhos + perdidos) · melhor canal: ${data[0]?.canal ?? "—"}`} />
      </div>
      <Card>
        <CardHeader
          title="Conversão por canal de origem"
          subtitle="De onde vêm os pacientes que realmente fecham"
          action={
            <div className="flex gap-2">
              <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 w-36 text-xs">
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
                <option value={180}>Últimos 6 meses</option>
              </Select>
              <Button size="sm" variant="outline" onClick={() => downloadCSV("conversao-por-canal", [["Canal", "Leads", "Convertidos", "Perdidos", "Em andamento", "Taxa", "Receita realizada", "Agendado"], ...data.map((d) => [d.canal, d.leads, d.convertidos, d.perdidos, d.emAndamento, pct(d.taxa), d.receita, d.agendado])])}><Download size={13} /> CSV</Button>
            </div>
          }
        />
        <div className="h-72 px-2 pb-2">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="canal" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
              <Bar dataKey="leads" name="Leads" fill="#b6d9d5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="convertidos" name="Convertidos" fill="#0f9d8f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Table
          head={["Canal", "Leads", "Ganhos", "Perdidos", "Em andamento", "Conversão", "Receita realizada", "Agendado"]}
          rows={data.map((d) => [
            <span key="c" className="font-medium">{d.canal}</span>,
            d.leads,
            d.convertidos,
            d.perdidos,
            d.emAndamento,
            <div key="t" className="flex items-center gap-2">
              <div className="h-1.5 w-20 rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${d.taxa * 100}%` }} /></div>
              <span className="font-medium">{pct(d.taxa)}</span>
            </div>,
            money(d.receita),
            money(d.agendado),
          ])}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "success" | "danger" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold capitalize tracking-tight tabular-nums", tone === "success" && "text-success", tone === "danger" && "text-danger")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function BarsList({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3 px-5 pb-5">
      {data.length === 0 && <p className="py-4 text-center text-sm text-muted">Sem lançamentos.</p>}
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs"><span>{d.label}</span><span className="font-semibold">{money(d.value)}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} /></div>
        </div>
      ))}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border text-left text-[11px] uppercase tracking-wide text-muted">
            {head.map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="px-4 py-8 text-center text-muted">Nenhum registro.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 hover:bg-surface-2/50">
              {r.map((c, j) => <td key={j} className="px-4 py-2.5 whitespace-nowrap">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
