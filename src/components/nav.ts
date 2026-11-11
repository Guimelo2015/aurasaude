import { BarChart3, CalendarDays, KanbanSquare, LayoutDashboard, ListChecks, Megaphone, MessageCircle, Settings, Users } from "lucide-react";
import type { Permission } from "@/lib/permissions";

export const NAV: { href: string; label: string; icon: typeof LayoutDashboard; perm: Permission }[] = [
  { href: "/hoje", label: "Meu dia", icon: ListChecks, perm: "hoje.view" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
  { href: "/atendimento", label: "Atendimento", icon: MessageCircle, perm: "atendimento.view" },
  { href: "/funil", label: "Funil", icon: KanbanSquare, perm: "funil.view" },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone, perm: "campanhas.view" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, perm: "agenda.view" },
  { href: "/pacientes", label: "Pacientes", icon: Users, perm: "pacientes.view" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, perm: "relatorios.view" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, perm: "config.view" },
];
