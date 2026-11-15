import {
  BarChart3, CalendarDays, KanbanSquare, LayoutDashboard, ListChecks, Megaphone, MessageCircle, Settings, Users,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

/** Subitem do menu: abre a mesma tela numa seção diferente (?aba=). */
export type NavChild = { label: string; aba: string; perm?: Permission };
export type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: Permission;
  children?: NavChild[];
};
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dia",
    label: "Dia a dia",
    items: [
      { href: "/hoje", label: "Meu dia", icon: ListChecks, perm: "hoje.view" },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" },
    ],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    items: [
      { href: "/atendimento", label: "Atendimento", icon: MessageCircle, perm: "atendimento.view" },
      { href: "/funil", label: "Funil", icon: KanbanSquare, perm: "funil.view" },
      {
        href: "/campanhas",
        label: "Campanhas",
        icon: Megaphone,
        perm: "campanhas.view",
        children: [
          { label: "Visão geral", aba: "visao_geral" },
          { label: "Nova campanha", aba: "nova", perm: "campanhas.edit" },
          { label: "Modelos prontos", aba: "modelos", perm: "campanhas.edit" },
        ],
      },
    ],
  },
  {
    id: "clinica",
    label: "Clínica",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays, perm: "agenda.view" },
      { href: "/pacientes", label: "Pacientes", icon: Users, perm: "pacientes.view" },
    ],
  },
  {
    id: "gestao",
    label: "Gestão",
    items: [
      {
        href: "/relatorios",
        label: "Relatórios",
        icon: BarChart3,
        perm: "relatorios.view",
        children: [
          { label: "Dinheiro parado", aba: "parado" },
          { label: "Vendas perdidas", aba: "perdidas" },
          { label: "Equipe", aba: "equipe" },
          { label: "Clientes ausentes", aba: "inatividade" },
          { label: "Financeiro", aba: "financeiro" },
          { label: "Faturamento mês a mês", aba: "faturamento" },
          { label: "Faltas (no-show)", aba: "faltas" },
          { label: "Conversão por canal", aba: "conversao" },
        ],
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      {
        href: "/configuracoes",
        label: "Configurações",
        icon: Settings,
        perm: "config.view",
        children: [
          { label: "Números de WhatsApp", aba: "whatsapp" },
          { label: "Agente de IA", aba: "ia" },
          { label: "Usuários", aba: "usuarios" },
          { label: "Procedimentos", aba: "procedimentos" },
          { label: "Teleconsulta", aba: "teleconsulta" },
          { label: "Reembolso", aba: "reembolso" },
        ],
      },
    ],
  },
];

/** Lista plana (busca global, permissões). */
export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const childHref = (item: NavItem, c: NavChild) => `${item.href}?aba=${c.aba}`;

export type NavMatch = { group?: NavGroup; item?: NavItem; child?: NavChild; title: string };

/**
 * Única fonte de verdade: a partir da URL (caminho + parâmetros), diz qual grupo,
 * item e subitem estão ativos e qual é o título da tela.
 */
export function resolveNav(pathname: string, search: string | URLSearchParams = ""): NavMatch {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname !== item.href && !pathname.startsWith(item.href + "/")) continue;
      let child: NavChild | undefined;
      if (item.children?.length) {
        const aba = params.get("aba");
        child = item.children.find((c) => c.aba === aba) ?? item.children[0];
      }
      const detail = pathname !== item.href;
      const title = detail ? `${item.label} · ficha` : child ? `${item.label} · ${child.label}` : item.label;
      return { group, item, child, title };
    }
  }
  return { title: "" };
}
