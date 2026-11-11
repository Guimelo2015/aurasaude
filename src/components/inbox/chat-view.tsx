"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRightLeft, Bot, CalendarPlus, CheckCircle2, Link2, PanelRight, RotateCcw, Send, Smartphone, UserRound, Zap } from "lucide-react";
import { Avatar, Badge, Button, Field, Modal, Select, toast } from "../ui";
import { useApp, useCurrentUser } from "@/lib/store";
import { simulateIncoming, useTyping } from "@/lib/ai/simulator";
import type { Conversation, Message } from "@/lib/types";
import { cn, fmtTime, maskPhone, shortName } from "@/lib/utils";
import { format, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QUEUES } from "@/lib/labels";

const QUICK_REPLIES = [
  "Olá! Aqui é do Instituto Equilíbrio, tudo bem? 😊",
  "Vou verificar a agenda e já te retorno, só um instante.",
  "Podemos confirmar sua consulta? Responda SIM para confirmar.",
  "Emitimos nota fiscal com CID e CRM para você solicitar o reembolso ao seu plano.",
  "Sua teleconsulta será por vídeo: enviaremos o link 15 minutos antes do horário.",
  "Nosso endereço: Rua Haddock Lobo, 595 – 8º andar. Estacionamento conveniado no prédio.",
];

export function ChatView({ conv, onBack, onTogglePanel, onSchedule }: { conv: Conversation; onBack: () => void; onTogglePanel: () => void; onSchedule: () => void }) {
  const allMessages = useApp((s) => s.messages);
  const instances = useApp((s) => s.instances);
  const users = useApp((s) => s.users);
  const aiName = useApp((s) => s.aiConfig.name);
  const { sendMessage, assumeConversation, closeConversation, reopenConversation, markRead, setQueue, transferConversation } = useApp.getState();
  const user = useCurrentUser();
  const typing = useTyping((s) => !!s.typing[conv.id]);
  const [text, setText] = useState("");
  const [asPatient, setAsPatient] = useState(conv.handler === "ia");
  const [transferOpen, setTransferOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => allMessages.filter((m) => m.conversationId === conv.id), [allMessages, conv.id]);
  const instance = instances.find((i) => i.id === conv.instanceId);
  const assigned = users.find((u) => u.id === conv.assignedUserId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);
  useEffect(() => {
    if (conv.unread) markRead(conv.id);
  }, [conv.id, conv.unread, markRead]);
  useEffect(() => setAsPatient(conv.handler === "ia"), [conv.id, conv.handler]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    if (asPatient) simulateIncoming(conv.id, t);
    else sendMessage(conv.id, t, "atendente");
  };

  const sendBookingLink = () => {
    sendMessage(conv.id, `Para escolher o melhor horário, é só acessar: https://aura.app/agendar/equilibrio?ref=${conv.id.slice(-6)} 📅`, "atendente", "link_agendamento");
    toast("Link de agendamento enviado");
  };

  const closed = conv.queue === "finalizado";

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Voltar">
          <ArrowLeft size={18} />
        </Button>
        <Avatar name={conv.contactName} size={38} />
        <div className="min-w-[140px] flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{conv.contactName}</p>
            {conv.handler === "ia" ? (
              <Badge tone="violet"><Bot size={11} /> {aiName} (IA)</Badge>
            ) : (
              <Badge tone="primary"><UserRound size={11} /> {assigned ? shortName(assigned.name) : "Humano"}</Badge>
            )}
            <Badge tone="neutral" className="hidden 2xl:inline-flex">{QUEUES.find((q) => q.id === conv.queue)?.label}</Badge>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted">
            <Smartphone size={11} /> {maskPhone(conv.phone)} · via {instance?.name}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {conv.handler === "ia" || conv.queue === "novo" ? (
            <Button size="sm" onClick={() => { assumeConversation(conv.id); toast("Você assumiu o atendimento"); }}>
              <UserRound size={14} /> Assumir
            </Button>
          ) : null}
          {!closed && (
            <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)} title="Transferir atendimento">
              <ArrowRightLeft size={14} /> <span className="hidden 2xl:inline">Transferir</span>
            </Button>
          )}
          {!closed ? (
            <Button size="sm" variant="outline" onClick={() => { closeConversation(conv.id); toast("Atendimento encerrado"); }} title="Encerrar atendimento">
              <CheckCircle2 size={14} /> <span className="hidden 2xl:inline">Encerrar</span>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => reopenConversation(conv.id)}>
              <RotateCcw size={14} /> Reabrir
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onTogglePanel} aria-label="Painel do contato" title="Painel do contato">
            <PanelRight size={17} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-chat-bg px-4 py-4 [background-image:radial-gradient(color-mix(in_srgb,var(--muted)_12%,transparent)_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="mx-auto max-w-3xl space-y-1.5">
          {messages.map((m, i) => (
            <MessageRow key={m.id} m={m} prev={messages[i - 1]} />
          ))}
          {typing && (
            <div className="flex justify-end">
              <div className="flex items-center gap-1 rounded-2xl rounded-br-sm bg-bubble-ia px-4 py-3">
                <Bot size={12} className="mr-1 text-violet" />
                {[0, 1, 2].map((d) => <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-violet" />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-surface p-3">
        {conv.handler === "ia" && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-violet-soft px-3 py-2 text-xs">
            <Bot size={14} className="text-violet" />
            <span className="flex-1">
              <b>{aiName}</b> está conduzindo a triagem. Ao concluir, envia o card de resumo para a fila <b>Novos</b>.
            </span>
            <Button size="sm" variant="outline" onClick={() => assumeConversation(conv.id)}>Assumir agora</Button>
          </div>
        )}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <ModeChip active={!asPatient} onClick={() => setAsPatient(false)} disabled={conv.handler === "ia"}>
            <UserRound size={12} /> Responder como {user ? shortName(user.name) : "atendente"}
          </ModeChip>
          <ModeChip active={asPatient} onClick={() => setAsPatient(true)}>
            <Smartphone size={12} /> Simular mensagem do paciente
          </ModeChip>
          <span className="mx-1 h-4 w-px bg-border" />
          <Button size="sm" variant="ghost" onClick={sendBookingLink} disabled={asPatient}>
            <Link2 size={13} /> Link de agendamento
          </Button>
          <Button size="sm" variant="ghost" onClick={onSchedule}>
            <CalendarPlus size={13} /> Agendar
          </Button>
          <div className="relative">
            <Button size="sm" variant="ghost" onClick={() => setQuickOpen((v) => !v)} disabled={asPatient}>
              <Zap size={13} /> Respostas rápidas
            </Button>
            {quickOpen && (
              <div className="animate-in absolute bottom-full left-0 z-20 mb-1 w-80 rounded-xl border border-border bg-surface p-1 shadow-xl">
                {QUICK_REPLIES.map((r) => (
                  <button key={r} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-surface-2 cursor-pointer" onClick={() => { setText(r); setQuickOpen(false); }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
          {conv.queue === "em_atendimento" && (
            <Button size="sm" variant="ghost" onClick={() => { setQueue(conv.id, "aguardando"); toast("Movido para 'Aguardando paciente'"); }}>
              Aguardar paciente
            </Button>
          )}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={asPatient ? `Digite como se fosse ${conv.contactName.split(" ")[0]} (paciente)…` : "Digite uma mensagem…"}
            className={cn(
              "max-h-32 min-h-10 flex-1 resize-none rounded-xl border bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:ring-2",
              asPatient ? "border-warning/50 focus:ring-warning/20" : "border-border focus:border-primary focus:ring-primary/20",
            )}
          />
          <Button size="icon" className="h-10 w-10 rounded-xl" onClick={send} aria-label="Enviar">
            <Send size={16} />
          </Button>
        </div>
      </div>

      <TransferModal open={transferOpen} onClose={() => setTransferOpen(false)} onConfirm={(t) => { transferConversation(conv.id, t); toast("Atendimento transferido"); setTransferOpen(false); }} currentUserId={user?.id} />
    </div>
  );
}

function ModeChip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        active ? "border-fg bg-fg text-bg" : "border-border text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function MessageRow({ m, prev }: { m: Message; prev?: Message }) {
  const showDay = !prev || !isSameDay(parseISO(prev.createdAt), parseISO(m.createdAt));
  const dayLabel = showDay ? format(parseISO(m.createdAt), "EEEE, d 'de' MMMM", { locale: ptBR }) : null;

  if (m.author === "sistema") {
    return (
      <>
        {dayLabel && <DayDivider label={dayLabel} />}
        <div className="flex justify-center py-1">
          <span className="rounded-full bg-surface/90 px-3 py-1 text-[11px] text-muted shadow-sm">{m.text} · {fmtTime(m.createdAt)}</span>
        </div>
      </>
    );
  }
  const incoming = m.author === "contato";
  const isIa = m.author === "ia";
  const linkified = m.text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <span key={i} className="break-all text-info underline">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
  const grouped = prev && prev.author === m.author && !showDay;

  return (
    <>
      {dayLabel && <DayDivider label={dayLabel} />}
      <div className={cn("animate-in flex", incoming ? "justify-start" : "justify-end", !grouped && "pt-1.5")}>
        <div
          className={cn(
            "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
            incoming && "rounded-bl-sm bg-bubble-in",
            isIa && "rounded-br-sm bg-bubble-ia",
            m.author === "atendente" && "rounded-br-sm bg-bubble-out",
            m.kind === "agendamento" && "border border-primary/40",
          )}
        >
          {!incoming && !grouped && (
            <p className={cn("mb-0.5 flex items-center gap-1 text-[11px] font-semibold", isIa ? "text-violet" : "text-primary-strong")}>
              {isIa ? <Bot size={11} /> : <UserRound size={11} />} {m.authorName}
            </p>
          )}
          <p className="whitespace-pre-wrap leading-relaxed">{linkified}</p>
          <p className="mt-0.5 text-right text-[10px] text-muted">{fmtTime(m.createdAt)}{!incoming && " ✓✓"}</p>
        </div>
      </div>
    </>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-md bg-surface px-2.5 py-0.5 text-[11px] font-medium capitalize text-muted shadow-sm">{label}</span>
    </div>
  );
}

function TransferModal({ open, onClose, onConfirm, currentUserId }: { open: boolean; onClose: () => void; onConfirm: (t: { userId?: string; instanceId?: string }) => void; currentUserId?: string }) {
  const allUsers = useApp((s) => s.users);
  const users = useMemo(() => allUsers.filter((u) => u.active && u.role !== "profissional" && u.id !== currentUserId), [allUsers, currentUserId]);
  const instances = useApp((s) => s.instances);
  const [mode, setMode] = useState<"user" | "dept">("user");
  const [userId, setUserId] = useState("");
  const [instanceId, setInstanceId] = useState("");
  useEffect(() => {
    if (open) {
      setUserId(users[0]?.id ?? "");
      setInstanceId(instances[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Transferir atendimento"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(mode === "user" ? { userId } : { instanceId })}>Transferir</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(["user", "dept"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded-lg border p-3 text-left text-sm cursor-pointer", mode === m ? "border-primary bg-primary-soft/50" : "border-border")}>
              <p className="font-medium">{m === "user" ? "Para um atendente" : "Para uma fila"}</p>
              <p className="text-xs text-muted">{m === "user" ? "Vai direto para a pessoa" : "Volta para 'Novos' do setor"}</p>
            </button>
          ))}
        </div>
        {mode === "user" ? (
          <Field label="Atendente">
            <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Departamento / número">
            <Select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>
              {instances.map((i) => <option key={i.id} value={i.id}>{i.department} ({i.name})</option>)}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
