import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const money = (v: number) => brl.format(v);
export const moneyCompact = (v: number) => brlCompact.format(v);
export const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

// ---------- CPF ----------
export function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isValidCPF(v: string) {
  const cpf = onlyDigits(v);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** Gera um CPF válido (apenas para dados de demonstração). */
export function fakeCPF(rand: () => number = Math.random) {
  const n = Array.from({ length: 9 }, () => Math.floor(rand() * 10));
  const dv = (arr: number[]) => {
    const len = arr.length;
    const sum = arr.reduce((s, d, i) => s + d * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  n.push(dv(n));
  n.push(dv(n));
  return n.join("");
}

// ---------- Telefone ----------
export function maskPhone(v: string) {
  let d = onlyDigits(v);
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function normalizePhone(v: string) {
  const d = onlyDigits(v);
  return d.startsWith("55") ? d : `55${d}`;
}

// ---------- Datas ----------
export const fmtDate = (iso: string, pattern = "dd/MM/yyyy") => format(parseISO(iso), pattern, { locale: ptBR });
export const fmtTime = (iso: string) => format(parseISO(iso), "HH:mm");
export const fmtRelative = (iso: string) =>
  formatDistanceToNowStrict(parseISO(iso), { locale: ptBR, addSuffix: true });

export function ageFrom(birth: string) {
  const b = parseISO(birth);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

/** "Dra. Camila Rocha" → "Camila"; "Aline Moraes" → "Aline" */
export function shortName(name: string) {
  return name.replace(/^(dr|dra|sr|sra)\.?\s+/i, "").split(" ")[0];
}

export const capitalizeFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** PRNG determinístico para o seed (mesma demo para todo mundo). */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
