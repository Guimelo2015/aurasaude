"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronsUpDown, LogOut, Menu, RotateCcw, Search, X } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Avatar, Badge, Button, toast } from "./ui";
import { CommandPalette } from "./command-palette";
import { NAV } from "./nav";
import { useApp, useCurrentUser, useHydrated } from "@/lib/store";
import { can, ROLE_LABEL } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pendingTasks = useApp((s) => {
    const today = new Date().toISOString().slice(0, 10);
    return s.tasks.filter((t) => !t.done && t.dueDate <= today).length;
  });

  // campanhas agendadas disparam na hora marcada; envios interrompidos (recarregar a página) são retomados
  useEffect(() => {
    if (!hydrated) return;
    const run = () => useApp.getState().runDueCampaigns();
    run();
    const t = setInterval(run, 20000);
    return () => clearInterval(t);
  }, [hydrated]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const clinic = useApp((s) => s.clinic);
  const logout = useApp((s) => s.logout);
  const resetDemo = useApp((s) => s.resetDemo);
  const pendingChats = useApp((s) => s.conversations.filter((c) => c.queue === "novo" || (c.queue !== "finalizado" && c.unread > 0)).length);

  const allowed = NAV.filter((n) => can(user?.role, n.perm));
  const current = NAV.find((n) => pathname.startsWith(n.href));

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/login");
    else if (current && !can(user.role, current.perm)) router.replace(allowed[0]?.href ?? "/login");
  }, [hydrated, user, current, allowed, router]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (!hydrated || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted">
          <Logo compact className="animate-pulse" />
          <span className="text-xs">Carregando dados da clínica…</span>
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
          <X size={18} />
        </Button>
      </div>
      <div className="mx-3 mb-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-muted">Clínica</p>
        <p className="truncate text-sm font-medium">{clinic.name}</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {allowed.map((n) => {
          const active = pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-primary-soft text-primary-strong" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <n.icon size={18} />
              <span className="flex-1">{n.label}</span>
              {n.href === "/atendimento" && pendingChats > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-fg">{pendingChats}</span>
              )}
              {n.href === "/hoje" && pendingTasks > 0 && (
                <span className="rounded-full bg-warning px-1.5 text-[10px] font-semibold text-white">{pendingTasks}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="relative border-t border-border p-3">
        <button onClick={() => setMenuOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-surface-2 cursor-pointer">
          <Avatar name={user.name} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted">{ROLE_LABEL[user.role]}</p>
          </div>
          <ChevronsUpDown size={14} className="text-muted" />
        </button>
        {menuOpen && (
          <div className="animate-in absolute bottom-full left-3 right-3 mb-1 rounded-xl border border-border bg-surface p-1 shadow-xl">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2 cursor-pointer"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              <LogOut size={15} /> Trocar de perfil
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft cursor-pointer"
              onClick={() => {
                if (confirm("Restaurar todos os dados de demonstração? As alterações feitas serão perdidas.")) {
                  resetDemo();
                  setMenuOpen(false);
                  toast("Dados de demonstração restaurados");
                }
              }}
            >
              <RotateCcw size={15} /> Resetar dados demo
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="animate-in absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={18} />
          </Button>
          <p className="text-sm font-medium">{current?.label}</p>
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-4 hidden h-8 w-72 items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 text-xs text-muted transition hover:border-primary/40 md:flex cursor-pointer"
          >
            <Search size={14} /> Buscar paciente, conversa…
            <kbd className="ml-auto rounded border border-border bg-surface px-1.5 text-[10px]">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Buscar">
              <Search size={17} />
            </Button>
            <Badge tone="warning" className="hidden sm:inline-flex">Modo demonstração</Badge>
            <ThemeToggle />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
