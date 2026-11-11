import { differenceInDays, parseISO } from "date-fns";
import type { Appointment, ID, Patient, PatientStatus, Procedure, SegmentFilters, TreatmentPlan } from "./types";

/**
 * Regras de organização da base de pacientes (funções puras).
 * Na fase 2 viram views/colunas calculadas no Postgres.
 */

export const STATUS_META: Record<PatientStatus, { label: string; tone: "info" | "violet" | "primary" | "success" | "warning" | "danger"; hint: string }> = {
  novo: { label: "Novo", tone: "info", hint: "Chegou nos últimos 30 dias" },
  vip: { label: "VIP", tone: "violet", hint: "Top 10% em valor investido e ativo" },
  em_tratamento: { label: "Em tratamento", tone: "primary", hint: "Plano de tratamento em andamento" },
  ativo: { label: "Ativo", tone: "success", hint: "Consulta nos últimos 60 dias ou agendada" },
  em_risco: { label: "Em risco", tone: "warning", hint: "60 a 180 dias sem consulta e nada agendado" },
  inativo: { label: "Inativo", tone: "danger", hint: "Mais de 180 dias sem consulta" },
};
export const STATUS_ORDER: PatientStatus[] = ["novo", "vip", "em_tratamento", "ativo", "em_risco", "inativo"];

export interface PatientIndexEntry {
  lastVisit?: string;
  lastConsult?: string;
  nextApt?: Appointment;
  visits: number;
  noShows: number;
  ltv: number;
}

export function buildPatientIndex(appointments: Appointment[], procedures: Procedure[], now = new Date()) {
  const nowIso = now.toISOString();
  const consultIds = new Set(procedures.filter((p) => p.category === "Consulta").map((p) => p.id));
  const idx: Record<ID, PatientIndexEntry> = {};
  for (const a of appointments) {
    const e = (idx[a.patientId] ??= { visits: 0, noShows: 0, ltv: 0 });
    if (a.status === "compareceu") {
      e.visits++;
      e.ltv += a.value;
      if (!e.lastVisit || a.start > e.lastVisit) e.lastVisit = a.start;
      if (consultIds.has(a.procedureId) && (!e.lastConsult || a.start > e.lastConsult)) e.lastConsult = a.start;
    }
    if (a.status === "faltou") e.noShows++;
    if (a.start > nowIso && a.status !== "cancelado" && (!e.nextApt || a.start < e.nextApt.start)) e.nextApt = a;
  }
  return idx;
}

export function vipThreshold(idx: Record<ID, PatientIndexEntry>) {
  const values = Object.values(idx).map((e) => e.ltv).sort((a, b) => b - a);
  return values[Math.max(0, Math.floor(values.length * 0.1) - 1)] ?? Infinity;
}

export function patientStatus(p: Patient, e: PatientIndexEntry | undefined, activePlanPatients: Set<ID>, vipMin: number, now = new Date()): PatientStatus {
  const created = differenceInDays(now, parseISO(p.createdAt));
  if (!e?.lastVisit) return created <= 30 || e?.nextApt ? "novo" : "inativo";
  const since = differenceInDays(now, parseISO(e.lastVisit));
  if (!e.nextApt && since > 180) return "inativo";
  if (!e.nextApt && since > 60) return "em_risco";
  if (e.ltv >= vipMin) return "vip";
  if (activePlanPatients.has(p.id)) return "em_tratamento";
  if (created <= 30 && e.visits <= 1) return "novo";
  return "ativo";
}

// ---------------- Planos de tratamento ----------------
export interface PlanProgress {
  done: number;
  remaining: number;
  pct: number;
  lastSession?: string;
  nextSession?: Appointment;
  stalled: boolean;
  daysSinceLast?: number;
  remainingValue: number;
}

export function planProgress(plan: TreatmentPlan, appointments: Appointment[], procedures: Procedure[], now = new Date()): PlanProgress {
  const nowIso = now.toISOString();
  const mine = appointments.filter((a) => a.patientId === plan.patientId && a.procedureId === plan.procedureId && a.start >= plan.createdAt);
  const done = mine.filter((a) => a.status === "compareceu").sort((a, b) => b.start.localeCompare(a.start));
  const next = mine.filter((a) => a.start > nowIso && a.status !== "cancelado").sort((a, b) => a.start.localeCompare(b.start))[0];
  const remaining = Math.max(0, plan.totalSessions - done.length);
  const lastSession = done[0]?.start;
  const daysSinceLast = lastSession ? differenceInDays(now, parseISO(lastSession)) : undefined;
  const stalled = plan.status === "ativo" && remaining > 0 && !next && (daysSinceLast ?? 999) > Math.max(14, plan.frequencyDays * 2);
  const price = procedures.find((p) => p.id === plan.procedureId)?.price ?? 0;
  return { done: done.length, remaining, pct: Math.min(1, done.length / plan.totalSessions), lastSession, nextSession: next, stalled, daysSinceLast, remainingValue: remaining * price };
}

export function activePlanPatients(plans: TreatmentPlan[], appointments: Appointment[], procedures: Procedure[]) {
  const s = new Set<ID>();
  for (const pl of plans) {
    if (pl.status !== "ativo") continue;
    const pr = planProgress(pl, appointments, procedures);
    if (pr.remaining > 0 && !pr.stalled) s.add(pl.patientId);
  }
  return s;
}

// ---------------- Segmentos ----------------
export function matchesFilters(p: Patient, status: PatientStatus, f: SegmentFilters) {
  const q = f.q?.trim().toLowerCase();
  const digits = q?.replace(/\D/g, "");
  if (f.status && status !== f.status) return false;
  if (f.tagId && !p.tags.includes(f.tagId)) return false;
  if (f.insurance && p.insurance !== f.insurance) return false;
  if (q && !(p.name.toLowerCase().includes(q) || p.email.includes(q) || (digits && (p.cpf.includes(digits) || p.phone.includes(digits))))) return false;
  return true;
}

// ---------------- Duplicados ----------------
const normName = (n: string) =>
  n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\./g, "").split(/\s+/).filter(Boolean);

export interface DuplicatePair {
  a: Patient;
  b: Patient;
  reasons: string[];
}

/** Ignora familiares que compartilham o telefone do responsável. */
export function findDuplicates(patients: Patient[]): DuplicatePair[] {
  const out: DuplicatePair[] = [];
  const seen = new Set<string>();
  const adults = patients.filter((p) => !p.guardianId);
  const byPhone: Record<string, Patient[]> = {};
  adults.forEach((p) => (byPhone[p.phone] ??= []).push(p));
  for (let i = 0; i < adults.length; i++) {
    for (let j = i + 1; j < adults.length; j++) {
      const a = adults[i], b = adults[j];
      const reasons: string[] = [];
      if (a.phone === b.phone) reasons.push("Mesmo WhatsApp");
      if (a.email.replace(/\d/g, "") === b.email.replace(/\d/g, "")) reasons.push("E-mail parecido");
      const na = normName(a.name), nb = normName(b.name);
      if (na[0] === nb[0] && na[na.length - 1] === nb[nb.length - 1]) reasons.push("Nome parecido");
      if (reasons.length >= 2) {
        const key = [a.id, b.id].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          // o mais antigo fica como principal
          out.push(a.createdAt <= b.createdAt ? { a, b, reasons } : { a: b, b: a, reasons });
        }
      }
    }
  }
  return out;
}

// ---------------- Retornos vencidos (recall) ----------------
export function overdueReturns(patients: Patient[], idx: Record<ID, PatientIndexEntry>, now = new Date(), minDays = 45, maxDays = 180) {
  return patients
    .map((p) => ({ p, e: idx[p.id] }))
    .filter(({ e }) => e?.lastConsult && !e.nextApt)
    .map(({ p, e }) => ({ patient: p, lastConsult: e!.lastConsult!, days: differenceInDays(now, parseISO(e!.lastConsult!)) }))
    .filter((r) => r.days >= minDays && r.days <= maxDays)
    .sort((a, b) => (b.patient.tags.includes("tag_receita") ? 1 : 0) - (a.patient.tags.includes("tag_receita") ? 1 : 0) || a.days - b.days);
}
