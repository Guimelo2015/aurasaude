"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, Tag as TagIcon } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Select, toast } from "./ui";
import { useApp, useCurrentUser } from "@/lib/store";
import { STATUS_META } from "@/lib/organize";
import type { ID, PatientStatus, Tag } from "@/lib/types";
import { cn, maskCPF } from "@/lib/utils";

// ---------------- Status ----------------
export function StatusBadge({ status, className }: { status: PatientStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <Badge tone={m.tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {m.label}
    </Badge>
  );
}

// ---------------- Etiquetas ----------------
export function TagChip({ tag, onRemove, small }: { tag: Tag; onRemove?: () => void; small?: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap", small ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]")}
      style={{ color: tag.color, borderColor: `color-mix(in srgb, ${tag.color} 35%, transparent)`, background: `color-mix(in srgb, ${tag.color} 10%, transparent)` }}
    >
      {tag.name}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer" aria-label={`Remover ${tag.name}`}>×</button>
      )}
    </span>
  );
}

export function TagList({ ids, max = 3 }: { ids: ID[]; max?: number }) {
  const tags = useApp((s) => s.tags);
  const list = ids.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as Tag[];
  if (!list.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.slice(0, max).map((t) => <TagChip key={t.id} tag={t} small />)}
      {list.length > max && <span className="text-[10px] text-muted">+{list.length - max}</span>}
    </span>
  );
}

const TAG_COLORS = ["#0f9d8f", "#3b82f6", "#8b5cf6", "#d9469f", "#f59e0b", "#dc3b3b", "#16a34a", "#64748b"];

export function TagEditor({ patientId, value }: { patientId: ID; value: ID[] }) {
  const tags = useApp((s) => s.tags);
  const { setPatientTags, createTag } = useApp.getState();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (id: ID) => setPatientTags(patientId, value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div ref={ref} className="relative inline-flex flex-wrap items-center gap-1.5">
      {value.map((id) => {
        const t = tags.find((x) => x.id === id);
        return t ? <TagChip key={id} tag={t} onRemove={() => toggle(id)} /> : null;
      })}
      <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted hover:border-primary hover:text-primary cursor-pointer">
        <TagIcon size={11} /> Etiqueta
      </button>
      {open && (
        <div className="animate-in absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
          {tags.map((t) => (
            <button key={t.id} onClick={() => toggle(t.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 cursor-pointer">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              <span className="flex-1">{t.name}</span>
              {value.includes(t.id) && <Check size={14} className="text-primary" />}
            </button>
          ))}
          <div className="mt-1 flex gap-1 border-t border-border pt-1.5">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nova etiqueta…" className="h-8 text-xs" />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!newName.trim()}
              onClick={() => {
                const t = createTag(newName.trim(), TAG_COLORS[tags.length % TAG_COLORS.length]);
                setPatientTags(patientId, [...value, t.id]);
                setNewName("");
              }}
              aria-label="Criar etiqueta"
            >
              <Plus size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Busca de paciente (reutilizável) ----------------
export function PatientPicker({ value, onChange, exclude, label = "Paciente" }: { value: ID; onChange: (id: ID) => void; exclude?: ID[]; label?: string }) {
  const patients = useApp((s) => s.patients);
  const [q, setQ] = useState("");
  const selected = patients.find((p) => p.id === value);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const d = s.replace(/\D/g, "");
    return patients.filter((p) => !exclude?.includes(p.id) && (p.name.toLowerCase().includes(s) || (d.length >= 3 && p.cpf.includes(d)))).slice(0, 6);
  }, [q, patients, exclude]);
  if (selected) {
    return (
      <Field label={label}>
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary-soft/50 px-3 py-2">
          <div>
            <p className="text-sm font-medium">{selected.name}</p>
            <p className="text-xs text-muted">CPF {maskCPF(selected.cpf)}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onChange("")}>Trocar</Button>
        </div>
      </Field>
    );
  }
  return (
    <Field label={label} required>
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou CPF…" className="pl-8" />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-surface p-1 shadow-lg">
            {results.map((p) => (
              <button key={p.id} className="block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-surface-2 cursor-pointer" onClick={() => onChange(p.id)}>
                {p.name} <span className="text-xs text-muted">· {maskCPF(p.cpf)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}

// ---------------- Tarefa ----------------
export function TaskModal({ open, onClose, patientId, leadId, defaultTitle }: { open: boolean; onClose: () => void; patientId?: ID; leadId?: ID; defaultTitle?: string }) {
  const users = useApp((s) => s.users);
  const me = useCurrentUser();
  const addTask = useApp((s) => s.addTask);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle ?? "");
    setDue(new Date().toISOString().slice(0, 10));
    setAssignee(me?.id ?? "");
  }, [open, defaultTitle, me]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Nova tarefa"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!title.trim()} onClick={() => { addTask({ title: title.trim(), dueDate: due, assignedUserId: assignee || undefined, patientId, leadId }); toast("Tarefa criada"); onClose(); }}>Criar tarefa</Button></>}
    >
      <div className="space-y-3">
        <Field label="O que precisa ser feito?" required><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ligar para confirmar documentação do reembolso" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prazo"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <Field label="Responsável">
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Lista de espera ----------------
export function WaitlistModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId?: ID }) {
  const professionals = useApp((s) => s.professionals);
  const procedures = useApp((s) => s.procedures);
  const add = useApp((s) => s.addToWaitlist);
  const [pid, setPid] = useState("");
  const [prof, setProf] = useState("");
  const [proc, setProc] = useState("");
  const [period, setPeriod] = useState("Qualquer horário");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!open) return;
    setPid(patientId ?? "");
    setProf(professionals[0]?.id ?? "");
    setProc(procedures[0]?.id ?? "");
    setNotes("");
  }, [open, patientId, professionals, procedures]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adicionar à lista de espera"
      subtitle="Quando um horário for liberado, o sistema sugere este paciente para o encaixe"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!pid} onClick={() => { add({ patientId: pid, professionalId: prof || undefined, procedureId: proc, preferredPeriod: period, notes: notes || undefined }); toast("Paciente adicionado à lista de espera"); onClose(); }}>Adicionar</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><PatientPicker value={pid} onChange={setPid} /></div>
        <Field label="Profissional">
          <Select value={prof} onChange={(e) => setProf(e.target.value)}>
            <option value="">Qualquer profissional</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Atendimento">
          <Select value={proc} onChange={(e) => setProc(e.target.value)}>{procedures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </Field>
        <Field label="Período preferido">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>{["Qualquer horário", "Manhã", "Tarde", "Noite"].map((x) => <option key={x}>{x}</option>)}</Select>
        </Field>
        <Field label="Observação"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: receita acaba sexta" /></Field>
      </div>
    </Modal>
  );
}

// ---------------- Plano de tratamento ----------------
export function PlanModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: ID }) {
  const professionals = useApp((s) => s.professionals);
  const procedures = useApp((s) => s.procedures);
  const addPlan = useApp((s) => s.addPlan);
  const presets = [
    { label: "Psicoterapia TCC — 24 sessões", proc: "proc_psico", prof: "prof_paula", total: 24, freq: 7 },
    { label: "Protocolo EMT — 30 sessões", proc: "proc_emt", prof: "prof_felipe", total: 30, freq: 3 },
    { label: "Acompanhamento psiquiátrico — 12 meses", proc: "proc_retorno", prof: "prof_ricardo", total: 12, freq: 30 },
    { label: "Avaliação neuropsicológica — 5 encontros", proc: "proc_neuro", prof: "prof_paula", total: 5, freq: 7 },
  ];
  const [preset, setPreset] = useState(0);
  const [title, setTitle] = useState(presets[0].label);
  const [proc, setProc] = useState(presets[0].proc);
  const [prof, setProf] = useState(presets[0].prof);
  const [total, setTotal] = useState(presets[0].total);
  const [freq, setFreq] = useState(presets[0].freq);
  const apply = (i: number) => {
    const p = presets[i];
    setPreset(i); setTitle(p.label); setProc(p.proc); setProf(p.prof); setTotal(p.total); setFreq(p.freq);
  };
  const price = procedures.find((p) => p.id === proc)?.price ?? 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo plano de tratamento"
      subtitle="Acompanha o progresso e avisa quando o paciente para no meio do tratamento"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => { addPlan({ patientId, professionalId: prof, procedureId: proc, title, totalSessions: total, frequencyDays: freq }); toast("Plano de tratamento criado"); onClose(); }}>Criar plano · {(total * price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Button></>}
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {presets.map((p, i) => (
          <button key={p.label} onClick={() => apply(i)} className={cn("rounded-full border px-2.5 py-1 text-xs cursor-pointer", preset === i ? "border-primary bg-primary-soft text-primary-strong" : "border-border text-muted hover:text-fg")}>{p.label}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do plano" className="sm:col-span-2"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Atendimento"><Select value={proc} onChange={(e) => setProc(e.target.value)}>{procedures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Profissional"><Select value={prof} onChange={(e) => setProf(e.target.value)}>{professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Total de sessões"><Input type="number" min={1} value={total} onChange={(e) => setTotal(Math.max(1, Number(e.target.value)))} /></Field>
        <Field label="Intervalo entre sessões (dias)"><Input type="number" min={1} value={freq} onChange={(e) => setFreq(Math.max(1, Number(e.target.value)))} /></Field>
      </div>
    </Modal>
  );
}

// ---------------- Responsável legal ----------------
export function GuardianModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: ID }) {
  const setGuardian = useApp((s) => s.setGuardian);
  const [gid, setGid] = useState("");
  const [relation, setRelation] = useState("Mãe");
  useEffect(() => { if (open) { setGid(""); setRelation("Mãe"); } }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Definir responsável legal"
      subtitle="Usado para menores de idade e pacientes com curatela"
      footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!gid} onClick={() => { setGuardian(patientId, gid, relation); toast("Responsável vinculado"); onClose(); }}>Vincular</Button></>}
    >
      <div className="space-y-3">
        <PatientPicker value={gid} onChange={setGid} exclude={[patientId]} label="Responsável (já cadastrado)" />
        <Field label="Parentesco">
          <Select value={relation} onChange={(e) => setRelation(e.target.value)}>{["Mãe", "Pai", "Avó/Avô", "Tutor(a) legal", "Curador(a)", "Cônjuge"].map((r) => <option key={r}>{r}</option>)}</Select>
        </Field>
      </div>
    </Modal>
  );
}
