"use client";

import { useMemo } from "react";
import { useApp, useCurrentUser } from "./store";
import { useOrganize } from "./use-organize";
import { can } from "./permissions";
import { matchesFilters, STATUS_ORDER } from "./organize";
import type { Patient, PatientStatus, SegmentFilters } from "./types";

export const PATIENT_PAGE = 20;
export type PatientSort = "nome" | "status" | "convenio" | "ultima" | "proximo";
const SORTS: PatientSort[] = ["nome", "status", "convenio", "ultima", "proximo"];

/** Parâmetros da lista que vivem na URL (e viajam para a ficha em ?lista=). */
export const LIST_KEYS = ["q", "status", "tag", "conv", "seg", "ordem", "dir", "pag"] as const;

export function listQuery(params: URLSearchParams) {
  const p = new URLSearchParams();
  for (const k of LIST_KEYS) {
    const v = params.get(k);
    if (v) p.set(k, v);
  }
  return p.toString();
}

/**
 * Lista de pacientes visível ao usuário, com filtros, ordenação e página vindos da URL.
 * Mesma regra de antes: profissional vê só quem ele atendeu.
 */
export function usePatientList(params: URLSearchParams) {
  const user = useCurrentUser();
  const allPatients = useApp((s) => s.patients);
  const appointments = useApp((s) => s.appointments);
  const { idx, status } = useOrganize();
  const seeAll = can(user?.role, "pacientes.all");

  const f: SegmentFilters = {
    q: params.get("q") ?? "",
    status: (params.get("status") ?? "") as PatientStatus | "",
    tagId: params.get("tag") ?? "",
    insurance: params.get("conv") ?? "",
  };
  const sortRaw = params.get("ordem") as PatientSort | null;
  const sort: PatientSort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : "nome";
  const dir: "asc" | "desc" = params.get("dir") === "desc" ? "desc" : "asc";
  const pageRaw = Number(params.get("pag") ?? "1");

  const mine = useMemo(() => {
    if (seeAll) return allPatients;
    const ids = new Set(appointments.filter((a) => a.professionalId === user?.professionalId).map((a) => a.patientId));
    return allPatients.filter((p) => ids.has(p.id));
  }, [seeAll, allPatients, appointments, user]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<PatientStatus, number>;
    mine.forEach((p) => c[status[p.id]]++);
    return c;
  }, [mine, status]);

  const { q, status: st, tagId, insurance } = f;
  const filtered = useMemo(() => {
    const ff = { q, status: st, tagId, insurance };
    const list = mine.filter((p) => matchesFilters(p, status[p.id], ff));
    const key = (p: Patient): string | number | undefined => {
      switch (sort) {
        case "status":
          return STATUS_ORDER.indexOf(status[p.id]);
        case "convenio":
          return p.insurance;
        case "ultima":
          return idx[p.id]?.lastVisit;
        case "proximo":
          return idx[p.id]?.nextApt?.start;
        default:
          return p.name;
      }
    };
    const mult = dir === "desc" ? -1 : 1;
    return list.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      // vazios sempre no fim, em qualquer direção
      if (ka === undefined || kb === undefined) return ka === kb ? a.name.localeCompare(b.name) : ka === undefined ? 1 : -1;
      const c = typeof ka === "number" && typeof kb === "number" ? ka - kb : String(ka).localeCompare(String(kb));
      return c !== 0 ? c * mult : a.name.localeCompare(b.name);
    });
  }, [mine, status, idx, q, st, tagId, insurance, sort, dir]);

  const pages = Math.max(1, Math.ceil(filtered.length / PATIENT_PAGE));
  const page = Math.min(pages - 1, Math.max(0, (Number.isFinite(pageRaw) ? pageRaw : 1) - 1));
  const rows = filtered.slice(page * PATIENT_PAGE, page * PATIENT_PAGE + PATIENT_PAGE);
  const hasFilter = !!(f.q || f.status || f.tagId || f.insurance);

  return { mine, counts, filtered, rows, page, pages, sort, dir, f, hasFilter, seeAll, idx, status };
}
