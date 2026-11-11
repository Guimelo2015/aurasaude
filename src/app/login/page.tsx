"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Bot, CalendarCheck, KanbanSquare, MessageCircle, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar, Badge, Card } from "@/components/ui";
import { useApp, useHydrated } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/permissions";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const hydrated = useHydrated();
  const users = useApp((s) => s.users);
  const clinic = useApp((s) => s.clinic);
  const professionals = useApp((s) => s.professionals);
  const login = useApp((s) => s.login);
  const router = useRouter();

  const enter = (id: string) => {
    login(id);
    const u = users.find((x) => x.id === id);
    router.push(u?.role === "profissional" ? "/agenda" : u?.role === "recepcao" ? "/hoje" : "/dashboard");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b7d72] via-[#0f9d8f] to-[#2cc2b1] p-12 text-white">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <Logo className="text-white [&_span_span]:text-white/80" />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">O CRM que atende, agenda e vende pela sua clínica.</h1>
          <p className="mt-4 text-white/80">WhatsApp com IA que faz a triagem como uma pessoa de verdade, funil de pacientes, agenda e relatórios num lugar só.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              [Bot, "Agente de IA que qualifica e passa o lead pronto para a recepção"],
              [MessageCircle, "Múltiplos números de WhatsApp em uma caixa unificada"],
              [KanbanSquare, "Funil visual do primeiro contato até o procedimento"],
              [CalendarCheck, "Agenda integrada ao chat e controle de faltas"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Bot;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                    <I size={16} />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} Aura Saúde · Protótipo navegável v0.1</p>
      </div>

      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </div>
        <div className="m-auto w-full max-w-md py-10">
          <Badge tone="primary" className="mb-3">
            <ShieldCheck size={12} /> Ambiente de demonstração
          </Badge>
          <h2 className="text-2xl font-semibold tracking-tight">Entrar como…</h2>
          <p className="mt-1 text-sm text-muted">
            {hydrated ? clinic.name : "Carregando…"} — escolha um perfil para ver o que cada usuário enxerga.
          </p>
          <div className="mt-6 space-y-2.5">
            {hydrated &&
              users
                .filter((u) => u.active)
                .map((u) => {
                  const prof = professionals.find((p) => p.id === u.professionalId);
                  return (
                    <Card key={u.id} className="group cursor-pointer p-3.5 transition hover:border-primary hover:shadow-md" onClick={() => enter(u.id)}>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-muted truncate">{prof ? prof.specialty : u.email}</p>
                        </div>
                        <Badge tone={u.role === "admin" ? "violet" : u.role === "recepcao" ? "info" : "primary"}>{ROLE_LABEL[u.role]}</Badge>
                        <ArrowRight size={16} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </Card>
                  );
                })}
          </div>
          <p className="mt-6 text-xs text-muted">
            Na versão de produção: login com e-mail e senha (Supabase Auth), com permissões aplicadas no banco (RLS).
          </p>
        </div>
      </div>
    </div>
  );
}
