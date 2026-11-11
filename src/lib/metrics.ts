import { differenceInDays, format, isSameDay, isWithinInterval, parseISO, startOfMonth, subDays, subMonths, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Appointment, Budget, Lead, Patient, PatientStatus, Professional, Source, Transaction, TreatmentPlan, User } from "./types";
import { PAID_SOURCES, SOURCES } from "./types";
import type { PlanProgress } from "./organize";
import { isRecoverable, RECOVERABLE_REASONS } from "./campaigns";

/**
 * Cálculos de indicadores. Funções puras — na fase 2 viram views/RPCs
 * no Postgres (ver supabase/migrations), com a mesma saída.
 */

export function todayKpis(appointments: Appointment[], leads: Lead[], now = new Date()) {
  const today = appointments.filter((a) => isSameDay(parseISO(a.start), now) && a.status !== "cancelado");
  // confirmados = confirmados pendentes + os que já compareceram hoje
  const confirmed = today.filter((a) => a.status === "confirmado" || a.status === "compareceu").length;
  const done = today.filter((a) => a.status === "compareceu");
  const noShows = today.filter((a) => a.status === "faltou").length;
  const finished = done.length + noShows;
  const forecast = today.reduce((s, a) => s + a.value, 0);
  const realized = done.reduce((s, a) => s + a.value, 0);
  const newLeads = leads.filter((l) => now.getTime() - parseISO(l.createdAt).getTime() <= 86400000).length;
  return {
    totalToday: today.length,
    confirmed,
    forecast,
    realized,
    newLeads,
    noShows,
    noShowRate: finished ? noShows / finished : 0,
  };
}

export function channelVolume(leads: Lead[], days = 30, now = new Date()) {
  const since = subDays(now, days).toISOString();
  const recent = leads.filter((l) => l.createdAt >= since);
  const group = (s: Source) => (PAID_SOURCES.includes(s) ? "Tráfego pago" : s === "Indicação" ? "Indicação" : "Orgânico");
  const out: Record<string, number> = { "Tráfego pago": 0, Indicação: 0, Orgânico: 0 };
  recent.forEach((l) => (out[group(l.source)] += 1));
  const bySource = SOURCES.map((s) => ({ source: s, leads: recent.filter((l) => l.source === s).length }));
  return { groups: Object.entries(out).map(([name, value]) => ({ name, value })), bySource };
}

/** Negociações abertas no funil (Em qualificação + Orçamento enviado) por tempo parado na etapa. */
export function openBudgetsByAge(leads: Lead[], now = new Date()) {
  const open = leads.filter((l) => l.stage === "orcamento" || l.stage === "qualificacao");
  const buckets = [
    { label: "0–2 dias", min: 0, max: 2 },
    { label: "3–7 dias", min: 3, max: 7 },
    { label: "8–15 dias", min: 8, max: 15 },
    { label: "+15 dias", min: 16, max: 9999 },
  ];
  return buckets.map((b) => {
    const items = open.filter((l) => {
      const d = differenceInDays(now, parseISO(l.stageChangedAt));
      return d >= b.min && d <= b.max;
    });
    return {
      faixa: b.label,
      orcamento: items.filter((l) => l.stage === "orcamento").reduce((s, l) => s + l.estimatedValue, 0),
      qualificacao: items.filter((l) => l.stage === "qualificacao").reduce((s, l) => s + l.estimatedValue, 0),
      qtd: items.length,
    };
  });
}

/**
 * Faturamento mês a mês. O mês corrente vem marcado como `parcial` e sua variação
 * é calculada contra o MESMO PERÍODO do mês anterior (dia 1 até o mesmo dia), não contra o mês cheio.
 */
export function monthlyRevenue(transactions: Transaction[], months = 12, now = new Date()) {
  const sumIn = (s: Date, e: Date, type: "entrada" | "saida") =>
    transactions.filter((t) => t.type === type && isWithinInterval(parseISO(t.date), { start: s, end: e })).reduce((x, t) => x + t.amount, 0);
  const rows = Array.from({ length: months }, (_, i) => {
    const ref = subMonths(now, months - 1 - i);
    const s = startOfMonth(ref);
    const e = endOfMonth(ref);
    const entradas = sumIn(s, e, "entrada");
    const saidas = sumIn(s, e, "saida");
    return { mes: format(ref, "MMM/yy", { locale: ptBR }), entradas, saidas, lucro: entradas - saidas, parcial: i === months - 1, variacao: 0 };
  });
  rows.forEach((r, i) => {
    if (i === 0) return;
    if (r.parcial) {
      const prevStart = startOfMonth(subMonths(now, 1));
      const prevSame = sumIn(prevStart, subMonths(now, 1), "entrada");
      r.variacao = prevSame ? (r.entradas - prevSame) / prevSame : 0;
    } else {
      const prev = rows[i - 1].entradas;
      r.variacao = prev ? (r.entradas - prev) / prev : 0;
    }
  });
  return rows;
}

/** Período anterior equivalente. Se o período atual ainda está em andamento, compara só o trecho já decorrido. */
export function previousComparableRange(period: Period, offset: number, now = new Date()) {
  const cur = periodRange(period, offset, now);
  const prev = periodRange(period, offset - 1, now);
  if (offset === 0 && period !== "dia") {
    const elapsed = now.getTime() - cur.start.getTime();
    return { ...prev, end: new Date(prev.start.getTime() + elapsed), label: `${prev.label} (mesmo período)` };
  }
  return prev;
}

export type Period = "dia" | "semana" | "mes";

export function periodRange(period: Period, offset = 0, now = new Date()) {
  if (period === "dia") {
    const d = subDays(now, -offset);
    return { start: startOfDay(d), end: endOfDay(d), label: format(d, "dd/MM/yyyy") };
  }
  if (period === "semana") {
    const d = subDays(now, -offset * 7);
    const s = startOfWeek(d, { weekStartsOn: 1 });
    const e = endOfWeek(d, { weekStartsOn: 1 });
    return { start: s, end: e, label: `${format(s, "dd/MM")} – ${format(e, "dd/MM/yyyy")}` };
  }
  const d = subMonths(now, -offset);
  return { start: startOfMonth(d), end: endOfMonth(d), label: format(d, "MMMM 'de' yyyy", { locale: ptBR }) };
}

export function financialSummary(transactions: Transaction[], start: Date, end: Date) {
  const inRange = transactions.filter((t) => isWithinInterval(parseISO(t.date), { start, end }));
  const entradas = inRange.filter((t) => t.type === "entrada");
  const saidas = inRange.filter((t) => t.type === "saida");
  const sum = (arr: Transaction[]) => arr.reduce((s, t) => s + t.amount, 0);
  const byCategory = (arr: Transaction[]) => {
    const m: Record<string, number> = {};
    arr.forEach((t) => (m[t.category] = (m[t.category] ?? 0) + t.amount));
    return Object.entries(m).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
  };
  const byMethod: Record<string, number> = {};
  entradas.forEach((t) => (byMethod[t.method] = (byMethod[t.method] ?? 0) + t.amount));
  return {
    bruto: sum(entradas),
    saidas: sum(saidas),
    liquido: sum(entradas) - sum(saidas),
    ticketMedio: entradas.length ? sum(entradas) / entradas.length : 0,
    atendimentos: entradas.length,
    entradasPorCategoria: byCategory(entradas),
    saidasPorCategoria: byCategory(saidas),
    porMetodo: Object.entries(byMethod).map(([metodo, valor]) => ({ metodo, valor })).sort((a, b) => b.valor - a.valor),
    lancamentos: inRange.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export function inactivePatients(patients: Patient[], appointments: Appointment[], months = 6, now = new Date()) {
  const limit = subMonths(now, months);
  const last: Record<string, string> = {};
  const future = new Set<string>();
  for (const a of appointments) {
    if (a.status === "compareceu" && (!last[a.patientId] || a.start > last[a.patientId])) last[a.patientId] = a.start;
    if (parseISO(a.start) > now && a.status !== "cancelado") future.add(a.patientId);
  }
  return patients
    .filter((p) => last[p.id] && parseISO(last[p.id]) < limit && !future.has(p.id))
    .map((p) => ({ patient: p, lastVisit: last[p.id], monthsAway: Math.floor(differenceInDays(now, parseISO(last[p.id])) / 30) }))
    .sort((a, b) => a.lastVisit.localeCompare(b.lastVisit));
}

export function noShowsByProfessional(appointments: Appointment[], professionals: Professional[], start: Date, end: Date) {
  return professionals.map((p) => {
    const apts = appointments.filter((a) => a.professionalId === p.id && isWithinInterval(parseISO(a.start), { start, end }) && ["compareceu", "faltou"].includes(a.status));
    const faltas = apts.filter((a) => a.status === "faltou");
    return {
      profissional: p.name,
      cor: p.color,
      total: apts.length,
      faltas: faltas.length,
      taxa: apts.length ? faltas.length / apts.length : 0,
      perda: faltas.reduce((s, a) => s + a.value, 0),
    };
  });
}

export function noShowsByMonth(appointments: Appointment[], months = 6, now = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const ref = subMonths(now, months - 1 - i);
    const s = startOfMonth(ref);
    const e = endOfMonth(ref);
    const apts = appointments.filter((a) => isWithinInterval(parseISO(a.start), { start: s, end: e }) && ["compareceu", "faltou"].includes(a.status));
    const faltas = apts.filter((a) => a.status === "faltou").length;
    return { mes: format(ref, "MMM", { locale: ptBR }), faltas, taxa: apts.length ? faltas / apts.length : 0 };
  });
}

export function teamStats(leads: Lead[], users: User[], days = 90, now = new Date()) {
  const since = subDays(now, days).toISOString();
  return users
    .filter((u) => u.role === "recepcao" && u.active)
    .map((u) => {
      const mine = leads.filter((l) => l.ownerUserId === u.id && l.createdAt >= since);
      const won = mine.filter((l) => l.stage === "agendado" || l.stage === "realizado");
      const lost = mine.filter((l) => l.stage === "perdido");
      const times = mine.map((l) => l.firstResponseMin).filter((x): x is number => x !== undefined);
      return {
        user: u,
        atendimentos: mine.length,
        convertidos: won.length,
        perdidos: lost.length,
        // taxa sobre leads DECIDIDOS (ganhos + perdidos); quem ainda negocia não entra na conta
        taxa: won.length + lost.length ? won.length / (won.length + lost.length) : 0,
        // só conta como receita o que já foi realizado (lead em "Na clínica / Realizado")
        receita: mine.filter((l) => l.stage === "realizado").reduce((s, l) => s + l.estimatedValue, 0),
        tempoResposta: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        abertos: mine.filter((l) => ["novo", "qualificacao", "orcamento"].includes(l.stage)).length,
      };
    })
    .sort((a, b) => b.receita - a.receita);
}

/** Faltas do período sem novo agendamento depois da falta. */
export function noShowsWithoutReschedule(appointments: Appointment[], days = 30, now = new Date()) {
  const since = subDays(now, days).toISOString();
  const nowIso = now.toISOString();
  return appointments.filter(
    (a) =>
      a.status === "faltou" &&
      a.start >= since &&
      a.start <= nowIso &&
      !appointments.some((b) => b.patientId === a.patientId && b.start > a.start && b.status !== "cancelado"),
  );
}

export function openBudgetsTotal(leads: Lead[], budgets: Budget[]) {
  const leadOpen = leads.filter((l) => l.stage === "orcamento");
  const patientOpen = budgets.filter((b) => b.status === "aberto" && b.patientId);
  return {
    leads: leadOpen,
    budgets: patientOpen,
    total: leadOpen.reduce((s, l) => s + l.estimatedValue, 0) + patientOpen.reduce((s, b) => s + b.total, 0),
  };
}

export function conversionByChannel(leads: Lead[], days = 180, now = new Date()) {
  const since = subDays(now, days).toISOString();
  const recent = leads.filter((l) => l.createdAt >= since);
  return SOURCES.map((s) => {
    const all = recent.filter((l) => l.source === s);
    const won = all.filter((l) => l.stage === "realizado" || l.stage === "agendado");
    const lost = all.filter((l) => l.stage === "perdido");
    return {
      canal: s,
      leads: all.length,
      convertidos: won.length,
      perdidos: lost.length,
      emAndamento: all.length - won.length - lost.length,
      // conversão sobre leads decididos (ganhos + perdidos)
      taxa: won.length + lost.length ? won.length / (won.length + lost.length) : 0,
      // receita = apenas o que já foi realizado
      receita: all.filter((l) => l.stage === "realizado").reduce((x, l) => x + l.estimatedValue, 0),
      agendado: all.filter((l) => l.stage === "agendado").reduce((x, l) => x + l.estimatedValue, 0),
    };
  }).sort((a, b) => b.taxa - a.taxa);
}

// =====================================================================
// DINHEIRO PARADO — cada paciente/lead entra em UM grupo só (sem dupla contagem).
// Prioridade: tratamento interrompido > orçamento em aberto > falta sem remarcar > paciente em risco.
// =====================================================================
export interface StalledItem {
  id: string;
  name: string;
  href?: string;
  detail: string;
  value: number;
  /** id usado em campanhas (paciente ou lead) */
  targetId: string;
}
export interface StalledGroup {
  key: "plans" | "budgets" | "noshow" | "risk";
  title: string;
  rule: string;
  items: StalledItem[];
  value: number;
}

export function stalledMoney(
  d: { patients: Patient[]; appointments: Appointment[]; leads: Lead[]; budgets: Budget[]; plans: TreatmentPlan[]; procedures: { id: string; name: string }[] },
  status: Record<string, PatientStatus>,
  progress: Record<string, PlanProgress>,
  now = new Date(),
): { groups: StalledGroup[]; total: number } {
  const taken = new Set<string>(); // pacientes já contados
  const name = (pid: string) => d.patients.find((p) => p.id === pid)?.name ?? "";

  // 1) tratamentos interrompidos: sessões restantes × preço da sessão
  const plans: StalledItem[] = [];
  for (const pl of d.plans) {
    const pr = progress[pl.id];
    if (!pr?.stalled || taken.has(pl.patientId)) continue;
    taken.add(pl.patientId);
    plans.push({
      id: pl.id, targetId: pl.patientId, name: name(pl.patientId), href: `/pacientes/${pl.patientId}?tab=tratamento`,
      detail: `${pl.title.split(" — ")[0]} · ${pr.done}/${pl.totalSessions} sessões · parado há ${pr.daysSinceLast} dias`, value: pr.remainingValue,
    });
  }

  // 2) orçamentos em aberto: leads em "Orçamento enviado" + orçamentos abertos de pacientes
  const budgets: StalledItem[] = [];
  for (const l of d.leads.filter((x) => x.stage === "orcamento")) {
    if (l.patientId && taken.has(l.patientId)) continue;
    if (l.patientId) taken.add(l.patientId);
    budgets.push({ id: l.id, targetId: l.id, name: l.name, detail: `${l.interest} · ${differenceInDays(now, parseISO(l.stageChangedAt))} dias sem resposta`, value: l.estimatedValue });
  }
  for (const b of d.budgets.filter((x) => x.status === "aberto" && x.patientId)) {
    if (taken.has(b.patientId!)) continue;
    taken.add(b.patientId!);
    budgets.push({ id: b.id, targetId: b.patientId!, name: name(b.patientId!), href: `/pacientes/${b.patientId}`, detail: `${b.items[0]?.description ?? "Orçamento"} · aberto há ${differenceInDays(now, parseISO(b.createdAt))} dias`, value: b.total });
  }

  // 3) faltas sem remarcação (últimos 60 dias): valor da consulta perdida
  const noshow: StalledItem[] = [];
  for (const a of noShowsWithoutReschedule(d.appointments, 60, now).sort((x, y) => y.start.localeCompare(x.start))) {
    if (taken.has(a.patientId)) continue;
    taken.add(a.patientId);
    noshow.push({ id: a.id, targetId: a.patientId, name: name(a.patientId), href: `/pacientes/${a.patientId}`, detail: `Faltou em ${format(parseISO(a.start), "dd/MM")} · ${d.procedures.find((p) => p.id === a.procedureId)?.name ?? ""}`, value: a.value });
  }

  // 4) pacientes em risco (60–180 dias sem consulta, nada agendado): valor da ÚLTIMA consulta do próprio paciente
  const risk: StalledItem[] = [];
  for (const p of d.patients) {
    if (status[p.id] !== "em_risco" || taken.has(p.id)) continue;
    const last = d.appointments.filter((a) => a.patientId === p.id && a.status === "compareceu").sort((a, b) => b.start.localeCompare(a.start))[0];
    if (!last) continue;
    taken.add(p.id);
    risk.push({ id: p.id, targetId: p.id, name: p.name, href: `/pacientes/${p.id}`, detail: `Última consulta há ${differenceInDays(now, parseISO(last.start))} dias`, value: last.value });
  }

  const g = (key: StalledGroup["key"], title: string, rule: string, items: StalledItem[]): StalledGroup => ({
    key, title, rule, items: items.sort((a, b) => b.value - a.value), value: items.reduce((s, i) => s + i.value, 0),
  });
  const groups = [
    g("plans", "Tratamentos interrompidos", "Sessões restantes do plano × preço da sessão", plans),
    g("budgets", "Orçamentos em aberto", "Valor da proposta enviada e ainda sem decisão", budgets),
    g("noshow", "Faltas sem reagendamento", "Valor da consulta perdida (últimos 60 dias, paciente não remarcou)", noshow),
    g("risk", "Pacientes em risco de abandono", "Valor da última consulta do paciente (60–180 dias sem consulta, nada agendado)", risk),
  ];
  return { groups, total: groups.reduce((s, x) => s + x.value, 0) };
}

// =====================================================================
// VENDAS PERDIDAS
// =====================================================================
export function lostSales(leads: Lead[], users: User[], days = 180, now = new Date()) {
  const since = subDays(now, days).toISOString();
  const decided = leads.filter((l) => l.stageChangedAt >= since && ["perdido", "agendado", "realizado"].includes(l.stage));
  const lost = decided.filter((l) => l.stage === "perdido");
  const won = decided.filter((l) => l.stage !== "perdido");
  const sum = (arr: Lead[]) => arr.reduce((s, l) => s + l.estimatedValue, 0);

  const group = <K extends string>(keyOf: (l: Lead) => K) => {
    const m = new Map<K, { lost: Lead[]; won: Lead[] }>();
    for (const l of decided) {
      const k = keyOf(l);
      if (!m.has(k)) m.set(k, { lost: [], won: [] });
      (l.stage === "perdido" ? m.get(k)!.lost : m.get(k)!.won).push(l);
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, perdidos: v.lost.length, ganhos: v.won.length, valor: sum(v.lost), taxaPerda: v.lost.length / (v.lost.length + v.won.length || 1) }));
  };

  const motivos = new Map<string, Lead[]>();
  lost.forEach((l) => {
    const k = l.lostReason ?? "Sem motivo informado";
    motivos.set(k, [...(motivos.get(k) ?? []), l]);
  });

  const recoverable = lost.filter((l) => isRecoverable(l, now));
  const recovered = leads.filter((l) => l.recoveredByCampaignId);
  return {
    perdidos: lost.length,
    ganhos: won.length,
    valorPerdido: sum(lost),
    taxaPerda: decided.length ? lost.length / decided.length : 0,
    porMotivo: [...motivos.entries()].map(([motivo, arr]) => ({ motivo, qtd: arr.length, valor: sum(arr), recuperavel: RECOVERABLE_REASONS.includes(motivo) })).sort((a, b) => b.valor - a.valor),
    porCanal: group((l) => l.source).sort((a, b) => b.valor - a.valor),
    porAtendente: group((l) => l.ownerUserId ?? "sem_responsavel").map((x) => ({ ...x, nome: users.find((u) => u.id === x.key)?.name ?? "Sem responsável" })).sort((a, b) => b.valor - a.valor),
    recuperaveis: recoverable,
    valorRecuperavel: sum(recoverable),
    recuperados: recovered,
    recuperadosAgendados: recovered.filter((l) => l.stage === "agendado" || l.stage === "realizado"),
  };
}
