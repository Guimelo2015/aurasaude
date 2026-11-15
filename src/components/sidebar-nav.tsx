"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS, childHref, resolveNav } from "./nav";
import { useTabs } from "@/lib/tabs-store";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

function usePersistedList(key: string) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    try {
      setList(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {}
  }, [key]);
  const save = (next: string[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    return next;
  };
  const toggle = (id: string) => setList((p) => save(p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const add = useCallback((id: string) => setList((p) => (p.includes(id) ? p : save([...p, id]))), []);
  return { list, toggle, add };
}

export function SidebarNav({ role, badges }: { role: Role | undefined; badges: Record<string, number> }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const active = resolveNav(pathname, search);
  const tabs = useTabs((s) => s.tabs);
  const closedGroups = usePersistedList("aura-nav-closed"); // grupos recolhidos (padrão: abertos)
  const openItems = usePersistedList("aura-nav-open"); // submenus abertos (padrão: fechados)
  const activeHref = active.item?.href;
  const addOpen = openItems.add;
  // ao entrar numa tela com submenu, ele abre sozinho
  useEffect(() => {
    if (activeHref && NAV_GROUPS.some((g) => g.items.some((i) => i.href === activeHref && i.children?.length))) addOpen(activeHref);
  }, [activeHref, addOpen]);

  return (
    <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-3" aria-label="Menu principal">
      {NAV_GROUPS.map((g) => {
        const items = g.items.filter((i) => can(role, i.perm));
        if (!items.length) return null;
        const groupOpen = !closedGroups.list.includes(g.id);
        return (
          <div key={g.id}>
            <button
              onClick={() => closedGroups.toggle(g.id)}
              aria-expanded={groupOpen}
              className="flex w-full items-center justify-between rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-fg cursor-pointer"
            >
              {g.label}
              <ChevronDown size={12} className={cn("transition", !groupOpen && "-rotate-90")} />
            </button>
            {groupOpen && (
              <div className="mt-0.5 space-y-0.5">
                {items.map((n) => {
                  const itemActive = active.item?.href === n.href;
                  const kids = (n.children ?? []).filter((c) => !c.perm || can(role, c.perm));
                  const base = "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition cursor-pointer";
                  const style = itemActive ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-fg";
                  const bar = itemActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />;

                  if (kids.length) {
                    const show = openItems.list.includes(n.href);
                    return (
                      <div key={n.href}>
                        <button onClick={() => openItems.toggle(n.href)} aria-expanded={show} className={cn(base, style)}>
                          {bar}
                          <n.icon size={18} />
                          <span className="flex-1 text-left">{n.label}</span>
                          <ChevronDown size={14} className={cn("transition", !show && "-rotate-90")} />
                        </button>
                        {show && (
                          <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                            {kids.map((c) => {
                              const childActive = itemActive && active.child?.aba === c.aba;
                              return (
                                <Link
                                  key={c.aba}
                                  href={childHref(n, c)}
                                  aria-current={childActive ? "page" : undefined}
                                  className={cn(
                                    "block rounded-md px-2.5 py-1.5 text-[13px] transition",
                                    childActive ? "font-bold text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-fg",
                                  )}
                                >
                                  {c.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // item simples: foca a aba aberta daquele caminho (com seus filtros)
                  const href = tabs.find((t) => t.key === n.href)?.href ?? n.href;
                  return (
                    <Link key={n.href} href={href} aria-current={itemActive ? "page" : undefined} className={cn(base, style)}>
                      {bar}
                      <n.icon size={18} />
                      <span className="flex-1">{n.label}</span>
                      {badges[n.href] > 0 && (
                        <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", n.href === "/hoje" ? "bg-warning text-white" : "bg-primary text-primary-fg")}>{badges[n.href]}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
