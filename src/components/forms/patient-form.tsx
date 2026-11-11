"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea, toast } from "../ui";
import { useApp } from "@/lib/store";
import { INSURANCES, SOURCES, type Insurance, type Patient, type Source } from "@/lib/types";
import { isValidCPF, maskCPF, maskPhone, normalizePhone, onlyDigits } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  patient?: Patient;
  initial?: Partial<Pick<Patient, "name" | "phone" | "source">> & { insurance?: string };
  onSaved?: (p: Patient) => void;
}

const empty = { cpf: "", name: "", phone: "", email: "", birthDate: "", insurance: "Particular" as Insurance, source: "Instagram" as Source, note: "" };

export function PatientFormModal({ open, onClose, patient, initial, onSaved }: Props) {
  const patients = useApp((s) => s.patients);
  const addPatient = useApp((s) => s.addPatient);
  const updatePatient = useApp((s) => s.updatePatient);
  const addNote = useApp((s) => s.addPatientNote);
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // lê `initial` só no momento de abrir (o pai recria o objeto a cada render)
  const initialRef = useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    const initial = initialRef.current;
    if (!open) return;
    setErrors({});
    if (patient) {
      setF({
        cpf: maskCPF(patient.cpf), name: patient.name, phone: maskPhone(patient.phone), email: patient.email,
        birthDate: patient.birthDate, insurance: patient.insurance, source: patient.source, note: "",
      });
    } else {
      const insurance = (INSURANCES as readonly string[]).includes(initial?.insurance ?? "") ? (initial!.insurance as Insurance) : "Particular";
      setF({ ...empty, name: initial?.name ?? "", phone: initial?.phone ? maskPhone(initial.phone) : "", source: initial?.source ?? "Instagram", insurance });
    }
  }, [open, patient]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    const cpf = onlyDigits(f.cpf);
    if (!cpf) e.cpf = "CPF é obrigatório";
    else if (!isValidCPF(cpf)) e.cpf = "CPF inválido";
    else if (patients.some((p) => p.cpf === cpf && p.id !== patient?.id)) e.cpf = "Já existe um paciente com este CPF";
    if (f.name.trim().split(/\s+/).length < 2) e.name = "Informe o nome completo";
    if (onlyDigits(f.phone).length < 10) e.phone = "WhatsApp inválido";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "E-mail inválido";
    if (!f.birthDate) e.birthDate = "Data de nascimento é obrigatória";
    else if (new Date(f.birthDate) > new Date()) e.birthDate = "Data no futuro";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    if (!validate()) return;
    const data = {
      cpf: onlyDigits(f.cpf), name: f.name.trim(), phone: normalizePhone(f.phone), email: f.email.trim().toLowerCase(),
      birthDate: f.birthDate, insurance: f.insurance, source: f.source,
    };
    if (patient) {
      updatePatient(patient.id, data);
      toast("Cadastro atualizado");
      onSaved?.({ ...patient, ...data });
    } else {
      const p = addPatient(data);
      if (f.note.trim()) addNote(p.id, f.note.trim());
      toast("Paciente cadastrado");
      onSaved?.(p);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? "Editar paciente" : "Novo paciente"}
      subtitle="Campos com * são obrigatórios"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>{patient ? "Salvar alterações" : "Cadastrar paciente"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" required error={errors.name} className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Maria Aparecida Souza" autoFocus />
        </Field>
        <Field label="CPF" required error={errors.cpf}>
          <Input value={f.cpf} onChange={(e) => set("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
        </Field>
        <Field label="Data de nascimento" required error={errors.birthDate}>
          <Input type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
        </Field>
        <Field label="WhatsApp" required error={errors.phone}>
          <Input value={f.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="tel" />
        </Field>
        <Field label="E-mail" required error={errors.email}>
          <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="paciente@email.com" />
        </Field>
        <Field label="Convênio">
          <Select value={f.insurance} onChange={(e) => set("insurance", e.target.value as Insurance)}>
            {INSURANCES.map((i) => <option key={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Como conheceu a clínica">
          <Select value={f.source} onChange={(e) => set("source", e.target.value as Source)}>
            {SOURCES.map((i) => <option key={i}>{i}</option>)}
          </Select>
        </Field>
        {!patient && (
          <Field label="Observação inicial" className="sm:col-span-2">
            <Textarea value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Alergias, preferências, observações comerciais…" />
          </Field>
        )}
      </div>
    </Modal>
  );
}
