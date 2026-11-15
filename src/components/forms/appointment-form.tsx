"use client";

import { useEffect, useMemo, useState } from "react";
import { addMinutes, format, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { Button, Field, Input, Modal, Select, toast } from "../ui";
import { useApp, useCurrentUser } from "@/lib/store";
import { isOnline, MODALITY_LABEL, type Appointment, type ID, type Modality } from "@/lib/types";
import { TeleConsentStatus } from "@/components/teleconsulta";
import { maskCPF, money } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  patientId?: ID;
  leadId?: ID;
  procedureId?: ID;
  professionalId?: ID;
  start?: Date;
  onSaved?: (a: Appointment) => void;
}

export function AppointmentFormModal({ open, onClose, patientId, leadId, procedureId, professionalId, start, onSaved }: Props) {
  const patients = useApp((s) => s.patients);
  const professionals = useApp((s) => s.professionals);
  const procedures = useApp((s) => s.procedures);
  const appointments = useApp((s) => s.appointments);
  const addAppointment = useApp((s) => s.addAppointment);
  const user = useCurrentUser();

  const [pid, setPid] = useState("");
  const [search, setSearch] = useState("");
  const [prof, setProf] = useState("");
  const [proc, setProc] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [value, setValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [modality, setModality] = useState<Modality>("presencial");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const s = start ?? new Date(Date.now() + 86400000);
    setPid(patientId ?? "");
    setSearch("");
    setProf(professionalId ?? user?.professionalId ?? professionals[0]?.id ?? "");
    const pr = procedures.find((p) => p.id === procedureId) ?? procedures[0];
    setProc(pr?.id ?? "");
    setValue(pr?.price ?? 0);
    setDate(format(s, "yyyy-MM-dd"));
    setTime(start ? format(s, "HH:mm") : "09:00");
    setNotes("");
    setModality(pr?.id === "proc_tele" ? "video" : "presencial");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patientId, procedureId, professionalId, start]);

  const procedure = procedures.find((p) => p.id === proc);
  const patient = patients.find((p) => p.id === pid);
  const professional = professionals.find((p) => p.id === prof);

  // Regras da teleconsulta: o procedimento precisa permitir e o profissional precisa atender online.
  const onlineBlock = !procedure?.onlineAllowed
    ? `"${procedure?.name ?? "Este procedimento"}" não é feito online (ajuste em Configurações → Procedimentos)`
    : professional && !professional.attendsOnline
      ? `${professional.name} não atende online (ajuste em Configurações → Teleconsulta)`
      : "";
  const priceFor = (p: typeof procedure, m: Modality) => (p ? (isOnline(m) && p.onlinePrice ? p.onlinePrice : p.price) : 0);
  const changeModality = (m: Modality) => {
    setModality(m);
    setValue(priceFor(procedure, m));
  };
  useEffect(() => {
    if (onlineBlock && isOnline(modality)) changeModality("presencial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineBlock]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return patients.filter((p) => p.name.toLowerCase().includes(q) || p.cpf.includes(q.replace(/\D/g, "") || "§")).slice(0, 6);
  }, [search, patients]);

  const conflict = useMemo(() => {
    if (!date || !time || !procedure) return undefined;
    const s = new Date(`${date}T${time}:00`);
    const e = addMinutes(s, procedure.durationMin);
    return appointments.find((a) => {
      if (a.professionalId !== prof || a.status === "cancelado") return false;
      const as = parseISO(a.start);
      const ae = addMinutes(as, a.durationMin);
      return as < e && ae > s;
    });
  }, [date, time, procedure, prof, appointments]);

  const save = () => {
    if (!pid) return setError("Selecione o paciente (o agendamento precisa estar vinculado a um cadastro).");
    if (!procedure) return setError("Selecione o procedimento.");
    if (conflict) return setError("Horário em conflito com outro agendamento deste profissional.");
    if (isOnline(modality) && onlineBlock) return setError(onlineBlock);
    const s = new Date(`${date}T${time}:00`);
    const apt = addAppointment({
      patientId: pid, professionalId: prof, procedureId: procedure.id, start: s.toISOString(),
      durationMin: procedure.durationMin, status: "agendado", value, leadId, notes: notes || undefined, modality,
    });
    toast("Agendamento criado");
    onSaved?.(apt);
    onClose();
  };

  const conflictPatient = conflict && patients.find((p) => p.id === conflict.patientId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo agendamento"
      subtitle="O agendamento fica vinculado ao cadastro do paciente e move o lead para 'Consulta Agendada'"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!!conflict}>Agendar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {patient ? (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary-soft/50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{patient.name}</p>
                <p className="text-xs text-muted">CPF {maskCPF(patient.cpf)} · {patient.insurance}</p>
              </div>
              {!patientId && <Button size="sm" variant="ghost" onClick={() => setPid("")}>Trocar</Button>}
            </div>
          ) : (
            <Field label="Paciente" required>
              <div className="relative">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou CPF…" autoFocus />
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface p-1 shadow-lg">
                    {results.map((p) => (
                      <button key={p.id} className="block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-surface-2 cursor-pointer" onClick={() => setPid(p.id)}>
                        {p.name} <span className="text-xs text-muted">· {maskCPF(p.cpf)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          )}
        </div>
        <Field label="Procedimento" required>
          <Select
            value={proc}
            onChange={(e) => {
              const next = procedures.find((p) => p.id === e.target.value);
              setProc(e.target.value);
              setValue(priceFor(next, next?.onlineAllowed ? modality : "presencial"));
            }}
          >
            {procedures.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}{p.onlineAllowed ? " · online" : ""}</option>)}
          </Select>
        </Field>
        <Field label="Profissional" required>
          <Select value={prof} onChange={(e) => setProf(e.target.value)}>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.specialty}</option>)}
          </Select>
        </Field>
        <Field label="Data" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Horário" required hint={procedure ? `Duração: ${procedure.durationMin} min` : undefined}>
          <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Valor (R$)">
          <Input type="number" min={0} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        </Field>
        <Field
          label="Modalidade"
          hint={onlineBlock ? `Online indisponível: ${onlineBlock}` : isOnline(modality) && procedure?.onlinePrice ? `Valor online: ${money(procedure.onlinePrice)}` : undefined}
        >
          <Select value={modality} onChange={(e) => changeModality(e.target.value as Modality)}>
            <option value="presencial">{MODALITY_LABEL.presencial}</option>
            <option value="video" disabled={!!onlineBlock}>{MODALITY_LABEL.video}</option>
            <option value="whatsapp" disabled={!!onlineBlock}>{MODALITY_LABEL.whatsapp}</option>
          </Select>
        </Field>
        {isOnline(modality) && patient && (
          <div className="sm:col-span-2">
            <TeleConsentStatus patient={patient} compact />
            {modality === "video" && <p className="mt-1 text-[11px] text-muted">O link da sala é gerado ao agendar e pode ser enviado ao paciente pelo detalhe do agendamento.</p>}
          </div>
        )}
        <Field label="Observações" className="sm:col-span-2">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
        </Field>
      </div>
      {conflict && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Conflito: {conflictPatient?.name} já está agendado(a) às {format(parseISO(conflict.start), "HH:mm")} com este profissional.
        </div>
      )}
      {error && !conflict && <p className="mt-3 text-xs text-danger">{error}</p>}
    </Modal>
  );
}
