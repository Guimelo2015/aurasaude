"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarDays, KanbanSquare, MessageCircle, Search, User, type LucideIcon } from "lucide-react";
import { useApp, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/permissions";
import { NAV } from "./nav";
import { cn, maskCPF, maskPhone, onlyDigits } from "@/lib/utils";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  href: string;
}

/** Busca global (Ctrl+K / ⌘K): páginas, pacientes, leads e conversas. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const user = useCurrentUser();
  const patients = useApp((s) => s.patients);
  const leads = useApp((s) => s.leads);
  const conversations = useApp((s) => s.conversations);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const d = onlyDigits(s);
    const pages: Item[] = NAV.filter((n) => can(user?.role, n.perm) && (!s || n.label.toLowerCase().includes(s))).map((n) => ({
      id: n.href, group: "Ir para", label: n.label, icon: n.icon, href: n.href,
    }));
    if (!s) return pages;
    const match = (name: string, phone?: string, cpf?: string) =>
      name.toLowerCase().includes(s) || (d.length >= 3 && ((phone ?? "").includes(d) || (cpf ?? "").includes(d)));
    const canSeePatients = can(user?.role, "pacientes.view");
    const canSeeCrm = can(user?.role, "funil.view");
    const pats: Item[] = canSeePatients
      ? patients.filter((p) => match(p.name, p.phone, p.cpf)).slice(0, 6).map((p) => ({
          id: p.id, group: "Pacientes", label: p.name, hint: `${maskCPF(p.cpf)} · ${maskPhone(p.phone)}`, icon: User, href: `/pacientes/${p.id}`,
        }))
      : [];
    const convs: Item[] = canSeeCrm
      ? conversations.filter((c) => match(c.contactName, c.phone)).slice(0, 4).map((c) => ({
          id: c.id, group: "Conversas", label: c.contactName, hint: `${c.department} · WhatsApp`, icon: MessageCircle, href: `/atendimento?c=${c.id}`,
        }))
      : [];
    const lds: Item[] = canSeeCrm
      ? leads.filter((l) => !l.patientId && match(l.name, l.phone)).slice(0, 4).map((l) => ({
          id: l.id, group: "Leads no funil", label: l.name, hint: l.interest, icon: KanbanSquare, href: `/funil?lead=${l.id}`,
        }))
      : [];
    const agenda: Item[] =
      s.includes("agenda") || s.includes("hoje") ? [{ id: "ag", group: "Atalhos", label: "Agenda de hoje", icon: CalendarDays, href: "/agenda" }] : [];
    return [...pages, ...pats, ...convs, ...lds, ...agenda];
  }, [q, patients, leads, conversations, user]);

  useEffect(() => setActive(0), [q]);

  if (!open || typeof document === "undefined") return null;

  const go = (it?: Item) => {
    if (!it) return;
    router.push(it.href);
    onClose();
  };

  let lastGroup = "";
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="animate-in w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={17} className="text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              if (e.key === "Enter") go(items[active]);
            }}
            placeholder="Buscar paciente, CPF, telefone, conversa ou página…"
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <p className="py-8 text-center text-sm text-muted">Nada encontrado para “{q}”.</p>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={`${it.group}-${it.id}`}>
                {header && <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{header}</p>}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it)}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm cursor-pointer", i === active ? "bg-primary-soft text-primary-strong" : "hover:bg-surface-2")}
                >
                  <it.icon size={16} className="shrink-0" />
                  <span className="flex-1 truncate font-medium">{it.label}</span>
                  {it.hint && <span className="truncate text-xs text-muted">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 border-t border-border px-4 py-2 text-[11px] text-muted">
          <span>↑↓ navegar</span><span>Enter abrir</span><span>Ctrl+K abrir de qualquer tela</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
