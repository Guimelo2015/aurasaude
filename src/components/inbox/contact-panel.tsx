"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMinutes, format, isSameDay, parseISO, setHours, setMinutes, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ExternalLink, FileText, Link2, Search, UserPlus } from "lucide-react";
import { Badge, Button, Input, Modal, Select, toast } from "../ui";
import { HandoffCard } from "./handoff-card";
import { StatusBadge, TagList } from "../organize";
import { useOrganize } from "@/lib/use-organize";
import { useApp } from "@/lib/store";
import { APT_STATUS, STAGES } from "@/lib/labels";
import type { Conversation, LeadStage } from "@/lib/types";
import { ageFrom, cn, maskCPF, money } from "@/lib/utils";

export function ContactPanel({ conv, onCreatePatient, onSchedule, onBudget }: { conv: Conversation; onCreatePatient: () => void; onSchedule: (start?: Date, professionalId?: string) => void; onBudget: () => void }) {
  const patient = useApp((s) => s.patients.find((p) => p.id === conv.patientId));
  const lead = useApp((s) => s.leads.find((l) => l.id === conv.leadId));
  const aiName = useApp((s) => s.aiConfig.name);
  const allApts = useApp((s) => s.appointments);
  const procedures = useApp((s) => s.procedures);
  const professionals = useApp((s) => s.professionals);
  const { moveLead } = useApp.getState();
  const { status } = useOrganize();
  const [linkOpen, setLinkOpen] = useState(false);

  const upcoming = useMemo(
    () =>
      patient
        ? allApts
            .filter((a) => a.patientId === patient.id && parseISO(a.start) >= startOfDay(new Date()))
            .sort((a, b) => a.start.localeCompare(b.start))
            .slice(0, 3)
        : [],
    [allApts, patient],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-4 p-4">
        {/* Cadastro */}
        <section>
          <SectionTitle>Cadastro do paciente</SectionTitle>
          {patient ? (
            <div className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{patient.name}</p>
                  <p className="text-xs text-muted">CPF {maskCPF(patient.cpf)} · {ageFrom(patient.birthDate)} anos</p>
                </div>
                <Link href={`/pacientes/${patient.id}`} className="text-muted hover:text-primary" title="Abrir prontuário">
                  <ExternalLink size={14} />
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <StatusBadge status={status[patient.id]} />
                <Badge tone="info">{patient.insurance}</Badge>
              </div>
              {patient.tags.length > 0 && <div className="mt-1.5"><TagList ids={patient.tags} max={4} /></div>}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-warning/50 bg-warning-soft/40 p-3">
              <p className="text-xs">Contato ainda <b>sem cadastro</b>. Para agendar é preciso vincular a um paciente (CPF obrigatório).</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={onCreatePatient}><UserPlus size={13} /> Cadastrar</Button>
                <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}><Link2 size={13} /> Vincular existente</Button>
              </div>
            </div>
          )}
        </section>

        {/* Card da IA */}
        {conv.handoff && (
          <section>
            <SectionTitle>Triagem</SectionTitle>
            <HandoffCard card={conv.handoff} aiName={aiName} />
          </section>
        )}

        {/* Funil */}
        {lead && (
          <section>
            <SectionTitle>Etapa no funil</SectionTitle>
            <Select value={lead.stage} onChange={(e) => { moveLead(lead.id, e.target.value as LeadStage); toast("Etapa do funil atualizada"); }}>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>Origem: <b className="text-fg">{lead.source}</b></span>
              {lead.estimatedValue > 0 && <span>Potencial: <b className="text-fg">{money(lead.estimatedValue)}</b></span>}
            </div>
            <Button size="sm" variant="outline" className="mt-2 w-full justify-center" onClick={onBudget}>
              <FileText size={13} /> Criar orçamento
            </Button>
          </section>
        )}

        {/* Agenda */}
        <section>
          <SectionTitle>Agenda rápida</SectionTitle>
          <MiniAgenda onPick={(d, prof) => onSchedule(d, prof)} />
        </section>

        {upcoming.length > 0 && (
          <section>
            <SectionTitle>Próximos agendamentos</SectionTitle>
            <div className="space-y-1.5">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs">
                  <CalendarDays size={14} className="text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{format(parseISO(a.start), "dd/MM 'às' HH:mm")}</p>
                    <p className="truncate text-muted">{procedures.find((p) => p.id === a.procedureId)?.name} · {professionals.find((p) => p.id === a.professionalId)?.name}</p>
                  </div>
                  <Badge tone={APT_STATUS[a.status].tone}>{APT_STATUS[a.status].label}</Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      <LinkPatientModal open={linkOpen} onClose={() => setLinkOpen(false)} conv={conv} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h4>;
}

function MiniAgenda({ onPick }: { onPick: (d: Date, professionalId: string) => void }) {
  const professionals = useApp((s) => s.professionals);
  const appointments = useApp((s) => s.appointments);
  const [prof, setProf] = useState(professionals[0]?.id ?? "");
  // depois das 17h (ou sábado após 11h) não há mais horário útil hoje → abre no próximo dia de atendimento
  const [day, setDay] = useState(() => {
    const now = new Date();
    let d = startOfDay(now);
    const lastHour = d.getDay() === 6 ? 11 : 18;
    if (d.getDay() === 0 || now.getHours() >= lastHour) d = addDays(d, 1);
    if (d.getDay() === 0) d = addDays(d, 1);
    return d;
  });

  const days = useMemo(() => {
    const out: Date[] = [];
    let d = startOfDay(new Date());
    while (out.length < 7) {
      if (d.getDay() !== 0) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, []);

  const slots = useMemo(() => {
    const busy = appointments.filter((a) => a.professionalId === prof && a.status !== "cancelado" && isSameDay(parseISO(a.start), day));
    const end = day.getDay() === 6 ? 12 : 20;
    const out: { at: Date; free: boolean }[] = [];
    for (let h = 8; h < end; h++) {
      if (h === 12) continue;
      for (const m of [0, 30]) {
        const at = setMinutes(setHours(day, h), m);
        const atEnd = addMinutes(at, 30);
        const taken = busy.some((a) => {
          const s = parseISO(a.start);
          return s < atEnd && addMinutes(s, a.durationMin) > at;
        });
        out.push({ at, free: !taken && at > new Date() });
      }
    }
    return out;
  }, [appointments, prof, day]);

  return (
    <div className="rounded-xl border border-border p-2.5">
      <Select value={prof} onChange={(e) => setProf(e.target.value)} className="h-8 text-xs">
        {professionals.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.specialty}</option>)}
      </Select>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((d) => (
          <button
            key={d.toISOString()}
            onClick={() => setDay(d)}
            className={cn("rounded-md py-1 text-center cursor-pointer", isSameDay(d, day) ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}
          >
            <p className="text-[9px] uppercase">{format(d, "EEE", { locale: ptBR }).slice(0, 3)}</p>
            <p className="text-xs font-semibold">{format(d, "dd")}</p>
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {slots.map((s) => (
          <button
            key={s.at.toISOString()}
            disabled={!s.free}
            onClick={() => onPick(s.at, prof)}
            className={cn(
              "rounded-md py-1 text-[11px] font-medium transition",
              s.free ? "bg-primary-soft text-primary-strong hover:bg-primary hover:text-primary-fg cursor-pointer" : "bg-surface-2 text-muted/50 line-through",
            )}
          >
            {format(s.at, "HH:mm")}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted">Clique num horário livre para agendar sem sair da conversa.</p>
    </div>
  );
}

function LinkPatientModal({ open, onClose, conv }: { open: boolean; onClose: () => void; conv: Conversation }) {
  const patients = useApp((s) => s.patients);
  const link = useApp((s) => s.linkPatientToConversation);
  const [q, setQ] = useState("");
  const results = patients
    .filter((p) => {
      const s = q.trim().toLowerCase();
      if (!s) return p.phone === conv.phone;
      return p.name.toLowerCase().includes(s) || p.cpf.includes(s.replace(/\D/g, "") || "§") || p.phone.includes(s.replace(/\D/g, "") || "§");
    })
    .slice(0, 8);
  return (
    <Modal open={open} onClose={onClose} size="sm" title="Vincular a paciente existente">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, CPF ou telefone…" className="pl-8" autoFocus />
      </div>
      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {results.length === 0 && <p className="py-6 text-center text-xs text-muted">{q ? "Nenhum paciente encontrado." : "Digite para buscar."}</p>}
        {results.map((p) => (
          <button
            key={p.id}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-surface-2 cursor-pointer"
            onClick={() => {
              link(conv.id, p.id);
              toast(`Conversa vinculada a ${p.name}`);
              onClose();
            }}
          >
            <span className="text-sm">{p.name}</span>
            <span className="text-xs text-muted">{maskCPF(p.cpf)}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
