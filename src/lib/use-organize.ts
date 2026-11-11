"use client";

import { useMemo } from "react";
import { useApp } from "./store";
import { activePlanPatients, buildPatientIndex, patientStatus, planProgress, vipThreshold } from "./organize";
import type { ID, PatientStatus } from "./types";

/** Índice de pacientes + status automático + progresso dos planos (memoizado). */
export function useOrganize() {
  const patients = useApp((s) => s.patients);
  const appointments = useApp((s) => s.appointments);
  const procedures = useApp((s) => s.procedures);
  const plans = useApp((s) => s.plans);

  return useMemo(() => {
    const idx = buildPatientIndex(appointments, procedures);
    const vipMin = vipThreshold(idx);
    const inPlan = activePlanPatients(plans, appointments, procedures);
    const status: Record<ID, PatientStatus> = {};
    for (const p of patients) status[p.id] = patientStatus(p, idx[p.id], inPlan, vipMin);
    const progress = Object.fromEntries(plans.map((pl) => [pl.id, planProgress(pl, appointments, procedures)]));
    const stalledPlans = plans.filter((pl) => progress[pl.id].stalled);
    return { idx, status, progress, stalledPlans, vipMin };
  }, [patients, appointments, procedures, plans]);
}
