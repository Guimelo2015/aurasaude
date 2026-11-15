"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea, toast } from "../ui";
import { useApp } from "@/lib/store";
import { INSURANCES, SOURCES, type Insurance, type Patient, type Source } from "@/lib/types";
import { isValidCPF, maskCPF, maskPhone, normalizePhone, onlyDigits } from "@/lib/utils";

type Initial = Partial<Pick<Patient, "name" | "phone" | "source">> & { insurance?: string };

interface Props {
  open: boolean;
  onClose: () => void;
  patient?: Patient;
  initial?: Initial;
  onSaved?: (p: Patient) => void;
}

const empty = {
  cpf: "", name: "", phone: "", email: "", birthDate: "", insurance: "Particular" as Insurance, source: "Instagram" as Source, note: "",
  /** particular que pede reembolso ao plano */
  reimb: false, reimbPlan: "", reimbCard: "",
};
type FormState = typeof empty;

function fromPatient(patient?: Patient, initial?: Initial): FormState {
  if (patient) {
    return {
      cpf: maskCPF(patient.cpf), name: patient.name, phone: maskPhone(patient.phone), email: patient.email,
      birthDate: patient.birthDate, insurance: patient.insurance, source: patient.source, note: "",
      reimb: !!patient.reimbursement, reimbPlan: patient.reimbursement?.plan ?? "", reimbCard: patient.reimbursement?.card ?? "",
    };
  }
  const insurance = (INSURANCES as readonly string[]).includes(initial?.insurance ?? "") ? (initial!.insurance as Insurance) : "Particular";
  // a triagem da IA registra "Particular · pede reembolso"
  const reimb = /reembolso/i.test(initial?.insurance ?? "");
  return { ...empty, name: initial?.name ?? "", phone: initial?.phone ? maskPhone(initial.phone) : "", source: initial?.source ?? "Instagram", insurance, reimb };
}

/**
 * Formulário do paciente (mesmas validações de sempre: CPF obrigatório, válido e único).
 * Fica direto na ficha (seção Dados) ou dentro da janela, ligado aos botões pelo atributo `form`.
 * Para "Cancelar", o pai remonta o componente (key) e todos os campos voltam ao valor salvo.
 */
export function PatientForm({
  formId,
  patient,
  initial,
  onSaved,
  onDirtyChange,
  readOnly,
  autoFocus,
}: {
  formId: string;
  patient?: Patient;
  initial?: Initial;
  onSaved?: (p: Patient) => void;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
}) {
  const patients = useApp((s) => s.patients);
  const addPatient = useApp((s) => s.addPatient);
  const updatePatient = useApp((s) => s.updatePatient);
  const addNote = useApp((s) => s.addPatientNote);
  // valor salvo, capturado ao montar
  const [base] = useState(() => fromPatient(patient, initial));
  const [f, setF] = useState(base);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dirty = useMemo(() => (Object.keys(base) as (keyof FormState)[]).some((k) => base[k] !== f[k]), [base, f]);
  const dirtyCb = useRef(onDirtyChange);
  dirtyCb.current = onDirtyChange;
  useEffect(() => dirtyCb.current?.(dirty), [dirty]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

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
    if (f.insurance === "Particular" && f.reimb && !f.reimbPlan.trim()) e.reimbPlan = "Informe o plano de saúde do reembolso";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !validate()) return;
    const data = {
      cpf: onlyDigits(f.cpf), name: f.name.trim(), phone: normalizePhone(f.phone), email: f.email.trim().toLowerCase(),
      birthDate: f.birthDate, insurance: f.insurance, source: f.source,
      reimbursement: f.insurance === "Particular" && f.reimb ? { plan: f.reimbPlan.trim(), card: f.reimbCard.trim() || undefined } : undefined,
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
  };

  return (
    <form id={formId} onSubmit={save} noValidate>
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" required error={errors.name} className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Maria Aparecida Souza" autoFocus={autoFocus} />
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
        {f.insurance === "Particular" && (
          <div className="space-y-3 rounded-xl border border-border p-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={f.reimb} onChange={(e) => set("reimb", e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
              Pede reembolso ao plano de saúde
            </label>
            {f.reimb && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Plano do reembolso" required error={errors.reimbPlan}>
                  <Input value={f.reimbPlan} onChange={(e) => set("reimbPlan", e.target.value)} placeholder="Ex.: SulAmérica Saúde" list="reimb-plans" />
                  <datalist id="reimb-plans">
                    {["SulAmérica Saúde", "Bradesco Saúde", "Amil", "Porto Saúde", "Omint", "Unimed", "Allianz Saúde", "Care Plus"].map((p) => <option key={p} value={p} />)}
                  </datalist>
                </Field>
                <Field label="Nº da carteirinha" hint="Opcional; sai no recibo">
                  <Input value={f.reimbCard} onChange={(e) => set("reimbCard", e.target.value)} />
                </Field>
              </div>
            )}
          </div>
        )}
        {!patient && (
          <Field label="Observação inicial" className="sm:col-span-2">
            <Textarea value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Alergias, preferências, observações comerciais…" />
          </Field>
        )}
      </fieldset>
    </form>
  );
}

/** Mesma janela de antes (usada no Atendimento, Funil, Dashboard e na lista de Pacientes). */
export function PatientFormModal({ open, onClose, patient, initial, onSaved }: Props) {
  // remonta o formulário a cada abertura, com os dados do momento
  const [mount, setMount] = useState(0);
  useEffect(() => {
    if (open) setMount((m) => m + 1);
  }, [open, patient]);
  const formId = "patient-form-modal";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? "Editar paciente" : "Novo paciente"}
      subtitle="Campos com * são obrigatórios"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form={formId}>{patient ? "Salvar alterações" : "Cadastrar paciente"}</Button>
        </>
      }
    >
      <PatientForm
        key={mount}
        formId={formId}
        patient={patient}
        initial={initial}
        autoFocus
        onSaved={(p) => {
          onSaved?.(p);
          onClose();
        }}
      />
    </Modal>
  );
}
