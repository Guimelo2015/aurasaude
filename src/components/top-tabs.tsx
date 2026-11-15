"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home, X } from "lucide-react";
import { resolveNav } from "./nav";
import { useTabs } from "@/lib/tabs-store";
import { useApp } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOME = "/dashboard";

/** Abas do topo, como num navegador: uma por caminho aberto; Dashboard fixo à esquerda. */
export function TopTabs({ role, fallbackHref }: { role: Role | undefined; fallbackHref: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const tabs = useTabs((s) => s.tabs);
  const { open, close, closeAll } = useTabs.getState();
  const patients = useApp((s) => s.patients);

  const qs = search.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;

  // toda navegação (menu, aba, link interno, mudança de filtro) atualiza a MESMA aba do caminho
  useEffect(() => {
    const m = resolveNav(pathname, qs);
    if (!m.item || !can(role, m.item.perm) || m.item.href === HOME) return;
    // uma aba por módulo: Registros e Cadastro (ficha) dividem a mesma aba
    open(m.item.href, href);
  }, [pathname, href, qs, role, open]);

  const visible = useMemo(
    () =>
      tabs.filter((t) => {
        const m = resolveNav(t.key);
        return m.item && can(role, m.item.perm) && t.key !== HOME;
      }),
    [tabs, role],
  );

  const titleOf = (t: { key: string; href: string }) => {
    const label = resolveNav(t.key).item?.label ?? t.key;
    const pid = t.href.match(/^\/pacientes\/([^/?]+)/)?.[1];
    if (pid) return `${label} · ${patients.find((p) => p.id === pid)?.name.split(" ")[0] ?? "ficha"}`;
    return label;
  };

  const go = (h: string) => router.push(h);
  const isActive = (key: string) => pathname === key || pathname.startsWith(key + "/");
  const onClose = (key: string) => {
    const i = visible.findIndex((t) => t.key === key);
    const wasActive = isActive(key);
    close(key);
    if (wasActive) {
      const next = visible[i + 1] ?? visible[i - 1];
      go(next?.href ?? (can(role, "dashboard.view") ? HOME : fallbackHref));
    }
  };

  const homeActive = pathname === HOME;
  const cls = (a: boolean) =>
    cn(
      "group flex h-8 shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 text-xs transition cursor-pointer",
      a ? "border-border bg-surface font-bold text-fg" : "border-transparent text-muted hover:bg-surface-2/70 hover:text-fg",
    );

  return (
    <div className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-border bg-surface-2/50 px-2 pt-1.5 [scrollbar-width:none]" role="tablist" aria-label="Telas abertas">
      {can(role, "dashboard.view") && (
        <button role="tab" aria-selected={homeActive} onClick={() => go(HOME)} className={cls(homeActive)} title="Dashboard">
          <Home size={14} />
        </button>
      )}
      {visible.map((t) => {
        const a = isActive(t.key);
        return (
          <div
            key={t.key}
            role="tab"
            tabIndex={0}
            aria-selected={a}
            onClick={() => go(t.href)}
            onKeyDown={(e) => e.key === "Enter" && go(t.href)}
            onMouseDown={(e) => e.button === 1 && e.preventDefault()}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onClose(t.key);
              }
            }}
            className={cls(a)}
          >
            <span className="max-w-40 truncate">{titleOf(t)}</span>
            <button
              aria-label={`Fechar ${titleOf(t)}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.key);
              }}
              className="grid h-4 w-4 place-items-center rounded hover:bg-border/70 cursor-pointer"
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
      {visible.length > 0 && (
        <button
          onClick={() => {
            closeAll();
            go(can(role, "dashboard.view") ? HOME : fallbackHref);
          }}
          className="mb-1 ml-auto shrink-0 rounded px-2 py-1 text-[11px] text-muted hover:text-fg cursor-pointer"
        >
          Fechar todas
        </button>
      )}
    </div>
  );
}
