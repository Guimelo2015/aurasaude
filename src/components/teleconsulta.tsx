"use client";

/**
 * Teleconsulta: ícone da modalidade, quadro da sala (link, enviar, entrar) e termo de
 * consentimento (CFM 2.314/2022 · CFP). O link de vídeo é simulado nesta fase.
 */
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Copy, ExternalLink, FileSignature, MessageCircle, Send, ShieldAlert, ShieldCheck, Video } from "lucide-react";
import { Button, Field, Modal, Select, toast } from "@/components/ui";
import { useApp } from "@/lib/store";
import { isOnline, MODALITY_LABEL, type Appointment, type Modality, type Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ModalityIcon({ m, size = 11, className }: { m?: Modality; size?: number; className?: string }) {
  if (m === "video") return <Video size={size} className={cn("shrink-0 text-info", className)} aria-label="Online · vídeo com link" />;
  if (m === "whatsapp") return <MessageCircle size={size} className={cn("shrink-0 text-success", className)} aria-label="Online · vídeo pelo WhatsApp" />;
  return null;
}

/** Termo de teleatendimento: mostra o texto e registra o aceite (quem registrou, quando e por onde). */
export function TeleConsentModal({ patient, open, onClose }: { patient?: Patient; open: boolean; onClose: () => void }) {
  const term = useApp((s) => s.settings.teleTerm);
  const register = useApp((s) => s.registerTeleConsent);
  const [channel, setChannel] = useState("WhatsApp");
  if (!patient) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Termo de teleatendimento"
      subtitle={`Paciente: ${patient.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              register(patient.id, channel);
              toast("Aceite do termo registrado");
              onClose();
            }}
          >
            <FileSignature size={14} /> Registrar aceite
          </Button>
        </>
      }
    >
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs leading-relaxed">{term}</div>
      <Field label="Como o paciente aceitou?" className="mt-3">
        <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option>WhatsApp</option>
          <option>E-mail</option>
          <option>Assinatura em papel</option>
          <option>Verbal, no início da consulta (registrado em prontuário)</option>
        </Select>
      </Field>
      <p className="mt-2 text-[11px] text-muted">Fica registrado quem marcou o aceite, a data e o canal. Na fase 2 o paciente aceita por um link.</p>
    </Modal>
  );
}

/** Situação do termo, com botão para registrar. */
export function TeleConsentStatus({ patient, compact }: { patient?: Patient; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!patient) return null;
  const c = patient.teleConsent;
  return (
    <>
      {c ? (
        <p className={cn("flex items-center gap-1.5 text-success", compact ? "text-[11px]" : "text-xs")}>
          <ShieldCheck size={compact ? 12 : 14} /> Termo de teleatendimento aceito em {format(parseISO(c.acceptedAt), "dd/MM/yyyy")} ({c.channel})
        </p>
      ) : (
        <div className={cn("flex flex-wrap items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-warning", compact ? "text-[11px]" : "text-xs")}>
          <ShieldAlert size={14} className="shrink-0" />
          <span className="flex-1">Sem termo de teleatendimento aceito. Registre o aceite antes da consulta online.</span>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <FileSignature size={12} /> Registrar aceite
          </Button>
        </div>
      )}
      <TeleConsentModal patient={patient} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Quadro da sala no detalhe do agendamento online. */
export function TeleRoom({ apt, patient }: { apt: Appointment; patient?: Patient }) {
  const conv = useApp((s) => s.conversations.find((c) => c.patientId === apt.patientId && c.queue !== "finalizado") ?? s.conversations.find((c) => c.patientId === apt.patientId));
  const sendMessage = useApp((s) => s.sendMessage);
  if (!isOnline(apt.modality)) return null;
  const when = format(parseISO(apt.start), "dd/MM 'às' HH:mm");
  const first = patient?.name.split(" ")[0] ?? "";
  const msg =
    apt.modality === "video"
      ? `Oi ${first}! Sua teleconsulta é ${when}. Entre por este link alguns minutos antes, em um local reservado: ${apt.videoLink}`
      : `Oi ${first}! Sua teleconsulta é ${when}, por chamada de vídeo aqui no WhatsApp. Fique em um local reservado que ligamos no horário 😊`;

  const send = () => {
    if (conv) sendMessage(conv.id, msg, "atendente");
    toast(conv ? `Mensagem enviada para ${first} na conversa do WhatsApp` : `Mensagem enviada para ${first} pelo WhatsApp (simulação)`);
  };

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-info/30 bg-info-soft/40 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <ModalityIcon m={apt.modality} size={14} /> {MODALITY_LABEL[apt.modality!]}
      </p>
      {apt.modality === "video" ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
          <code className="flex-1 truncate text-xs">{apt.videoLink}</code>
          <button
            type="button"
            className="text-muted hover:text-fg cursor-pointer"
            aria-label="Copiar link"
            onClick={async () => {
              try { await navigator.clipboard.writeText(apt.videoLink ?? ""); } catch {}
              toast("Link copiado");
            }}
          >
            <Copy size={13} />
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">O profissional faz a chamada de vídeo pelo WhatsApp da clínica no horário marcado.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={send}>
          <Send size={13} /> {apt.modality === "video" ? "Enviar link ao paciente" : "Avisar o paciente"}
        </Button>
        {apt.modality === "video" ? (
          <Button size="sm" onClick={() => toast("Sala de vídeo aberta (simulação: na fase 2 abre o Google Meet / Zoom)", "info")}>
            <ExternalLink size={13} /> Entrar na consulta
          </Button>
        ) : (
          patient && (
            <a href={`https://wa.me/${patient.phone}`} target="_blank" rel="noreferrer">
              <Button size="sm"><MessageCircle size={13} /> Abrir WhatsApp</Button>
            </a>
          )
        )}
      </div>
      <TeleConsentStatus patient={patient} compact />
    </div>
  );
}
