import type { Role } from "./types";

export type Permission =
  | "hoje.view"
  | "dashboard.view"
  | "financeiro.view"
  | "atendimento.view"
  | "funil.view"
  | "agenda.view"
  | "agenda.all" // ver agenda de todos os profissionais
  | "pacientes.view"
  | "pacientes.all" // ver todos os pacientes (e não só os próprios)
  | "pacientes.edit"
  | "relatorios.view"
  | "config.view"
  | "campanhas.view"
  | "campanhas.edit";

const MATRIX: Record<Role, Permission[]> = {
  admin: [
    "hoje.view",
    "dashboard.view",
    "financeiro.view",
    "atendimento.view",
    "funil.view",
    "agenda.view",
    "agenda.all",
    "pacientes.view",
    "pacientes.all",
    "pacientes.edit",
    "relatorios.view",
    "config.view",
    "campanhas.view",
    "campanhas.edit",
  ],
  recepcao: [
    "hoje.view",
    "dashboard.view",
    "atendimento.view",
    "funil.view",
    "agenda.view",
    "agenda.all",
    "pacientes.view",
    "pacientes.all",
    "pacientes.edit",
    "campanhas.view",
  ],
  profissional: ["dashboard.view", "agenda.view", "pacientes.view"],
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  recepcao: "Recepção",
  profissional: "Profissional",
};

export function can(role: Role | undefined, perm: Permission) {
  return !!role && MATRIX[role].includes(perm);
}
