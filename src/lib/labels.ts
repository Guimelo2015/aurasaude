import type { AppointmentStatus, LeadStage, Queue } from "./types";

export const STAGES: { id: LeadStage; label: string; hint: string; color: string }[] = [
  { id: "novo", label: "Novo Lead (WhatsApp)", hint: "Primeiro contato via automação", color: "#3b82f6" },
  { id: "qualificacao", label: "Em Qualificação / Triagem", hint: "IA ou recepção entendendo a necessidade", color: "#8b5cf6" },
  { id: "orcamento", label: "Orçamento Enviado", hint: "Avaliando valores", color: "#f59e0b" },
  { id: "agendado", label: "Consulta Agendada", hint: "Data e hora marcadas", color: "#0f9d8f" },
  { id: "realizado", label: "Na Clínica / Realizado", hint: "Compareceu e realizou", color: "#16a34a" },
  { id: "perdido", label: "Perdido / Sem Resposta", hint: "Alvo de recuperação", color: "#dc3b3b" },
];

export const QUEUES: { id: Queue; label: string; short: string }[] = [
  { id: "ia", label: "IA em atendimento", short: "IA" },
  { id: "novo", label: "Novos atendimentos", short: "Novos" },
  { id: "em_atendimento", label: "Em atendimento", short: "Atendendo" },
  { id: "aguardando", label: "Aguardando paciente", short: "Aguardando" },
  { id: "finalizado", label: "Finalizados", short: "Finalizados" },
];

export const APT_STATUS: Record<AppointmentStatus, { label: string; tone: "info" | "primary" | "success" | "danger" | "neutral" }> = {
  agendado: { label: "Agendado", tone: "info" },
  confirmado: { label: "Confirmado", tone: "primary" },
  compareceu: { label: "Compareceu", tone: "success" },
  faltou: { label: "Faltou", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export const URGENCY = {
  alta: { label: "Urgência alta", tone: "danger" as const },
  media: { label: "Urgência média", tone: "warning" as const },
  baixa: { label: "Urgência baixa", tone: "neutral" as const },
};
