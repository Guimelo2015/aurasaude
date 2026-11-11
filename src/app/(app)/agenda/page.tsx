"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMinutes, format, isSameDay, isToday, parseISO, setHours, setMinutes, startOfDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ban, CalendarPlus, Check, CheckCheck, ChevronLeft, ChevronRight, MessageCircle, UserX, Video } from "lucide-react";
import { Badge, Button, Card, Modal, PageHeader, Select, Tabs, toast } from "@/components/ui";
import { AppointmentFormModal } from "@/components/forms/appointment-form";
import { useApp, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/permissions";
import { APT_STATUS } from "@/lib/labels";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { cn, maskPhone, money } from "@/lib/utils";

const START_H = 8;
const END_H = 20;
const CONFIRM_LABEL: Record<string, string> = { enviada: "Enviada, aguardando", confirmou: "✓ Confirmou", cancelou: "Cancelou", sem_resposta: "Sem resposta" };
const HOUR_PX = 64;

export default function AgendaPage() {
  const user = useCurrentUser();
  const allProfessionals = useApp((s) => s.professionals);
  const appointments = useApp((s) => s.appointments);
  const patients = useApp((s) => s.patients);
  const procedures = useApp((s) => s.procedures);
  const seeAll = can(user?.role, "agenda.all");
  const professionals = seeAll ? allProfessionals : allProfessionals.filter((p) => p.id === user?.professionalId);

  const [view, setView] = useState<"dia" | "semana">(seeAll ? "dia" : "semana");
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [weekProf, setWeekProf] = useState(professionals[0]?.id ?? "");
  const [create, setCreate] = useState<{ start: Date; professionalId: string } | null>(null);
  const [openApt, setOpenApt] = useState<Appointment | null>(null);

  const days = view === "dia" ? [date] : Array.from({ length: 6 }, (_, i) => addDays(startOfWeek(date, { weekStartsOn: 1 }), i));
  const columns =
    view === "dia"
      ? professionals.map((p) => ({ key: p.id, day: date, prof: p, title: p.name, sub: p.specialty }))
      : days.map((d) => ({ key: d.toISOString(), day: d, prof: professionals.find((p) => p.id === weekProf)!, title: format(d, "EEE dd/MM", { locale: ptBR }), sub: "" }));

  const dayApts = useMemo(() => appointments.filter((a) => days.some((d) => isSameDay(parseISO(a.start), d)) && professionals.some((p) => p.id === a.professionalId)), [appointments, days, professionals]);
  const stats = {
    total: dayApts.filter((a) => a.status !== "cancelado").length,
    confirmados: dayApts.filter((a) => a.status === "confirmado").length,
    compareceu: dayApts.filter((a) => a.status === "compareceu").length,
    faltas: dayApts.filter((a) => a.status === "faltou").length,
  };

  const shift = (n: number) => setDate((d) => addDays(d, view === "dia" ? n : n * 7));
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i);
  const nowLine = (new Date().getHours() - START_H + new Date().getMinutes() / 60) * HOUR_PX;

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        title="Agenda"
        subtitle={view === "dia" ? format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : `Semana de ${format(days[0], "dd/MM")} a ${format(days[5], "dd/MM")}`}
        actions={
          <>
            <Tabs value={view} onChange={setView} items={[{ value: "dia", label: "Dia" }, { value: "semana", label: "Semana" }]} />
            {view === "semana" && seeAll && (
              <Select value={weekProf} onChange={(e) => setWeekProf(e.target.value)} className="w-52">
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Anterior"><ChevronLeft size={16} /></Button>
              <Button variant="outline" onClick={() => setDate(startOfDay(new Date()))}>Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Próximo"><ChevronRight size={16} /></Button>
            </div>
            <Button onClick={() => setCreate({ start: setHours(addDays(date, 0), 9), professionalId: view === "semana" ? weekProf : professionals[0]?.id })}>
              <CalendarPlus size={15} /> Agendar
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Badge tone="neutral" className="px-2.5 py-1 text-xs">{stats.total} agendamentos</Badge>
        <Badge tone="primary" className="px-2.5 py-1 text-xs">{stats.confirmados} confirmados</Badge>
        <Badge tone="success" className="px-2.5 py-1 text-xs">{stats.compareceu} atendidos</Badge>
        <Badge tone="danger" className="px-2.5 py-1 text-xs">{stats.faltas} faltas</Badge>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(140px, 1fr))` }}>
              <div />
              {columns.map((c) => (
                <div key={c.key} className={cn("border-l border-border px-3 py-2.5", view === "semana" && isToday(c.day) && "bg-primary-soft/50")}>
                  <div className="flex items-center gap-2">
                    {view === "dia" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.prof.color }} />}
                    <p className="truncate text-sm font-semibold capitalize">{c.title}</p>
                  </div>
                  {c.sub && <p className="text-[11px] text-muted">{c.sub}</p>}
                </div>
              ))}
            </div>
            <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(140px, 1fr))` }}>
              <div>
                {hours.map((h) => (
                  <div key={h} className="relative border-b border-border/50 text-right" style={{ height: HOUR_PX }}>
                    <span className="absolute -top-2 right-2 text-[10px] text-muted">{String(h).padStart(2, "0")}:00</span>
                  </div>
                ))}
              </div>
              {columns.map((c) => {
                const apts = appointments.filter((a) => a.professionalId === c.prof?.id && isSameDay(parseISO(a.start), c.day));
                const closed = c.day.getDay() === 0;
                return (
                  <div key={c.key} className={cn("relative border-l border-border", closed && "bg-surface-2/60")}>
                    {hours.map((h) =>
                      [0, 30].map((m) => (
                        <button
                          key={`${h}${m}`}
                          disabled={closed}
                          onClick={() => setCreate({ start: setMinutes(setHours(c.day, h), m), professionalId: c.prof.id })}
                          className={cn("block w-full hover:bg-primary-soft/50 cursor-pointer disabled:cursor-default", m === 30 ? "border-b border-border/50" : "border-b border-dashed border-border/30")}
                          style={{ height: HOUR_PX / 2 }}
                          aria-label={`Agendar ${h}:${m || "00"}`}
                        />
                      )),
                    )}
                    {isToday(c.day) && nowLine > 0 && nowLine < (END_H - START_H) * HOUR_PX && (
                      <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-danger" style={{ top: nowLine }}>
                        <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-danger" />
                      </div>
                    )}
                    {apts.map((a) => {
                      const s = parseISO(a.start);
                      const top = (s.getHours() - START_H + s.getMinutes() / 60) * HOUR_PX;
                      const height = Math.max((a.durationMin / 60) * HOUR_PX - 2, 22);
                      const p = patients.find((x) => x.id === a.patientId);
                      const proc = procedures.find((x) => x.id === a.procedureId);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setOpenApt(a)}
                          className={cn(
                            "absolute left-1 right-1 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-[11px] shadow-sm transition hover:z-20 hover:shadow-md cursor-pointer",
                            a.status === "cancelado" && "opacity-40 line-through",
                            a.status === "faltou" && "bg-danger-soft",
                            a.status === "compareceu" && "opacity-70",
                          )}
                          style={{ top, height, borderLeftColor: c.prof.color, background: a.status === "faltou" ? undefined : `color-mix(in srgb, ${c.prof.color} 14%, var(--surface))` }}
                        >
                          <p className="flex items-center gap-1 truncate font-semibold">
                            {a.modality === "online" && <Video size={11} className="shrink-0 text-info" />}
                            {a.confirmation === "confirmou" && a.status !== "compareceu" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" title="Confirmou pelo WhatsApp" />}
                            <span className="truncate">{p?.name ?? "Paciente"}</span>
                          </p>
                          {height > 30 && <p className="truncate text-muted">{format(s, "HH:mm")} · {proc?.name}</p>}
                          {height > 50 && (
                            <span className="mt-0.5 inline-block">
                              <Badge tone={APT_STATUS[a.status].tone} className="text-[9px]">{APT_STATUS[a.status].label}</Badge>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <AppointmentFormModal open={!!create} onClose={() => setCreate(null)} start={create?.start} professionalId={create?.professionalId} />
      <AppointmentDetail apt={openApt ? appointments.find((a) => a.id === openApt.id) ?? null : null} onClose={() => setOpenApt(null)} />
    </div>
  );
}

function AppointmentDetail({ apt, onClose }: { apt: Appointment | null; onClose: () => void }) {
  const patient = useApp((s) => s.patients.find((p) => p.id === apt?.patientId));
  const proc = useApp((s) => s.procedures.find((p) => p.id === apt?.procedureId));
  const prof = useApp((s) => s.professionals.find((p) => p.id === apt?.professionalId));
  const conv = useApp((s) => s.conversations.find((c) => c.patientId === apt?.patientId));
  const waitlist = useApp((s) => s.waitlist);
  const allPatients = useApp((s) => s.patients);
  const { setAppointmentStatus, fillSlotFromWaitlist } = useApp.getState();
  if (!apt) return null;
  const s = parseISO(apt.start);
  const set = (st: AppointmentStatus, msg: string) => {
    setAppointmentStatus(apt.id, st);
    toast(msg);
  };
  return (
    <Modal open onClose={onClose} title={patient?.name ?? "Agendamento"} subtitle={`${format(s, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })} – ${format(addMinutes(s, apt.durationMin), "HH:mm")}`}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-[11px] uppercase text-muted">Procedimento</p><p className="font-medium">{proc?.name}</p></div>
        <div><p className="text-[11px] uppercase text-muted">Profissional</p><p className="font-medium">{prof?.name}</p></div>
        <div><p className="text-[11px] uppercase text-muted">Valor</p><p className="font-medium">{money(apt.value)}</p></div>
        <div><p className="text-[11px] uppercase text-muted">Status</p><Badge tone={APT_STATUS[apt.status].tone}>{APT_STATUS[apt.status].label}</Badge></div>
        <div><p className="text-[11px] uppercase text-muted">WhatsApp</p><p className="font-medium">{patient && maskPhone(patient.phone)}</p></div>
        <div><p className="text-[11px] uppercase text-muted">Convênio</p><p className="font-medium">{patient?.insurance}</p></div>
        <div><p className="text-[11px] uppercase text-muted">Modalidade</p><p className="flex items-center gap-1 font-medium">{apt.modality === "online" ? <><Video size={13} className="text-info" /> Online (vídeo)</> : "Presencial"}</p></div>
        <div><p className="text-[11px] uppercase text-muted">Confirmação WhatsApp</p><p className="font-medium">{CONFIRM_LABEL[apt.confirmation ?? ""] ?? "Não enviada"}</p></div>
      </div>
      {apt.status === "cancelado" && parseISO(apt.start) > new Date() && !apt.notes?.includes("reaproveitado") && (
        <div className="mt-4 rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
          <p className="text-sm font-medium">Horário liberado: encaixar alguém da lista de espera?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {waitlist.filter((w) => !w.professionalId || w.professionalId === apt.professionalId).slice(0, 3).map((w) => (
              <Button key={w.id} size="sm" variant="secondary" onClick={() => { fillSlotFromWaitlist(apt.id, w.id); toast(`Vaga oferecida e confirmada para ${allPatients.find((p) => p.id === w.patientId)?.name}`); onClose(); }}>
                Encaixar {allPatients.find((p) => p.id === w.patientId)?.name.split(" ")[0]}
              </Button>
            ))}
            {!waitlist.some((w) => !w.professionalId || w.professionalId === apt.professionalId) && <p className="text-xs text-muted">Ninguém na lista de espera para este profissional.</p>}
          </div>
        </div>
      )}
      {apt.notes && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">{apt.notes}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => set("confirmado", "Consulta confirmada")}><Check size={13} /> Confirmar</Button>
        <Button size="sm" onClick={() => set("compareceu", "Atendimento registrado — receita lançada no financeiro")}><CheckCheck size={13} /> Compareceu</Button>
        <Button size="sm" variant="outline" className="text-danger" onClick={() => set("faltou", "Falta registrada")}><UserX size={13} /> Faltou</Button>
        <Button size="sm" variant="ghost" onClick={() => set("cancelado", "Agendamento cancelado")}><Ban size={13} /> Cancelar</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" variant="outline" onClick={() => toast(`Lembrete enviado para ${patient?.name.split(" ")[0]} via WhatsApp (simulação)`, "info")}>
          <MessageCircle size={13} /> Enviar lembrete
        </Button>
        {conv && <Link href={`/atendimento?c=${conv.id}`}><Button size="sm" variant="ghost">Abrir conversa</Button></Link>}
        {patient && <Link href={`/pacientes/${patient.id}`}><Button size="sm" variant="ghost">Ver prontuário</Button></Link>}
      </div>
    </Modal>
  );
}
