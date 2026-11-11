"use client";

import { useMemo, useState } from "react";
import { Bot, Search, Sparkles, UserRound } from "lucide-react";
import { Avatar, Badge, Button, Input } from "../ui";
import { useApp } from "@/lib/store";
import { URGENCY } from "@/lib/labels";
import type { Conversation, ID, Queue } from "@/lib/types";

// 3 abas na tela; o modelo (5 filas) continua igual por baixo.
type Tab = "ativos" | "fila" | "finalizados";
const TABS: { id: Tab; label: string; queues: Queue[] }[] = [
  { id: "ativos", label: "Ativos", queues: ["ia", "em_atendimento", "aguardando"] },
  { id: "fila", label: "Fila", queues: ["novo"] },
  { id: "finalizados", label: "Finalizados", queues: ["finalizado"] },
];
import { cn, fmtTime } from "@/lib/utils";
import { isToday, parseISO } from "date-fns";
import { useTyping } from "@/lib/ai/simulator";

export function ConversationList({ selectedId, onSelect, onSimulate }: { selectedId?: ID; onSelect: (id: ID) => void; onSimulate: () => void }) {
  const conversations = useApp((s) => s.conversations);
  const messages = useApp((s) => s.messages);
  const instances = useApp((s) => s.instances);
  const typing = useTyping((s) => s.typing);
  const [queue, setQueue] = useState<Tab>("ativos");
  const [instance, setInstance] = useState<string>("todos");
  const [q, setQ] = useState("");

  const lastMsg = useMemo(() => {
    const map: Record<ID, string> = {};
    for (const m of messages) if (m.author !== "sistema") map[m.conversationId] = m.text;
    return map;
  }, [messages]);

  const byInstance = conversations.filter((c) => instance === "todos" || c.instanceId === instance);
  const counts = Object.fromEntries(TABS.map((t) => [t.id, byInstance.filter((c) => t.queues.includes(c.queue)).length])) as Record<Tab, number>;

  const list = byInstance
    .filter((c) => TABS.find((t) => t.id === queue)!.queues.includes(c.queue))
    .filter((c) => !q || c.contactName.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
    .sort((a, b) => {
      // urgência alta e não lidas primeiro na fila de novos
      const ua = a.handoff?.urgency === "alta" && a.queue === "novo" ? 1 : 0;
      const ub = b.handoff?.urgency === "alta" && b.queue === "novo" ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    });

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversa…" className="h-8 pl-8 text-xs" />
          </div>
          <Button size="sm" variant="secondary" onClick={onSimulate} title="Simular um novo contato chegando pelo WhatsApp">
            <Sparkles size={13} /> Simular
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {[{ id: "todos", name: "Todos os números", color: "" }, ...instances].map((i) => (
            <button
              key={i.id}
              onClick={() => setInstance(i.id)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition cursor-pointer",
                instance === i.id ? "border-primary bg-primary-soft text-primary-strong" : "border-border text-muted hover:text-fg",
              )}
            >
              {i.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: i.color }} />}
              {i.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setQueue(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition cursor-pointer",
                queue === t.id ? "bg-fg text-bg" : "text-muted hover:bg-surface-2",
              )}
            >
              {t.label}
              <span className={cn("opacity-70", t.id === "fila" && counts.fila > 0 && queue !== "fila" && "rounded-full bg-primary px-1.5 text-white opacity-100")}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {list.length === 0 && <p className="p-6 text-center text-xs text-muted">Nenhuma conversa aqui.</p>}
        {list.map((c) => (
          <ConversationRow key={c.id} c={c} active={c.id === selectedId} last={typing[c.id] ? "digitando…" : lastMsg[c.id] ?? ""} typing={!!typing[c.id]} onClick={() => onSelect(c.id)} instanceColor={instances.find((i) => i.id === c.instanceId)?.color} />
        ))}
      </div>
    </div>
  );
}

function ConversationRow({ c, active, last, typing, onClick, instanceColor }: { c: Conversation; active: boolean; last: string; typing: boolean; onClick: () => void; instanceColor?: string }) {
  const at = parseISO(c.lastMessageAt);
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full gap-3 border-b border-border/60 px-3 py-3 text-left transition cursor-pointer",
        active ? "bg-primary-soft/60" : "hover:bg-surface-2",
        c.handoff?.urgency === "alta" && c.queue === "novo" && "border-l-2 border-l-danger",
      )}
    >
      <div className="relative">
        <Avatar name={c.contactName} size={40} />
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-surface" style={{ background: c.handler === "ia" ? "var(--violet)" : "var(--primary)" }}>
          {c.handler === "ia" ? <Bot size={8} className="text-white" /> : <UserRound size={8} className="text-white" />}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{c.contactName}</p>
          <span className="ml-auto shrink-0 text-[10px] text-muted">{isToday(at) ? fmtTime(c.lastMessageAt) : at.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
        </div>
        <p className={cn("truncate text-xs", typing ? "text-violet italic" : "text-muted")}>{last}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: instanceColor }} />
          <span className="text-[10px] text-muted">{c.department}</span>
          {c.handler === "ia" ? <Badge tone="violet">IA atendendo</Badge> : c.queue === "novo" ? <Badge tone="info">Aguardando humano</Badge> : null}
          {c.handoff && c.queue === "novo" && <Badge tone={URGENCY[c.handoff.urgency].tone}>{c.handoff.interest}</Badge>}
          {c.unread > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-fg">{c.unread}</span>}
        </div>
      </div>
    </button>
  );
}
