/**
 * Modelo de domínio do Aura Saúde.
 * Espelha 1:1 o schema SQL em supabase/migrations — ao plugar o backend,
 * apenas a camada de dados (store) muda; telas e regras continuam iguais.
 * Todas as entidades pertencem a uma clínica (multi-tenant via clinicId).
 */

export type ID = string;
export type ISODate = string; // ISO 8601

// ---------- Tenancy & usuários ----------
export interface Clinic {
  id: ID;
  name: string;
  cnpj?: string;
  city?: string;
}

export type Role = "admin" | "recepcao" | "profissional";

export interface User {
  id: ID;
  clinicId: ID;
  name: string;
  email: string;
  role: Role;
  professionalId?: ID; // quando role = profissional
  active: boolean;
}

export interface Professional {
  id: ID;
  clinicId: ID;
  name: string;
  specialty: string;
  /** registro no conselho (CRM / CRP) */
  council?: string;
  color: string; // cor na agenda
}

// ---------- Catálogo ----------
export const PROCEDURE_CATEGORIES = ["Consulta", "Psicoterapia", "Avaliação", "Neuromodulação", "Documentos"] as const;
export type ProcedureCategory = (typeof PROCEDURE_CATEGORIES)[number];

export interface Procedure {
  id: ID;
  clinicId: ID;
  name: string;
  category: ProcedureCategory;
  price: number;
  durationMin: number;
}

export const INSURANCES = [
  "Particular",
  "Particular (reembolso)",
  "Unimed",
  "Bradesco Saúde",
  "SulAmérica Saúde",
  "Amil",
  "Porto Saúde",
] as const;
export type Insurance = (typeof INSURANCES)[number];

export const SOURCES = [
  "Meta Ads",
  "Instagram",
  "Google",
  "Indicação",
  "Site",
  "Passante",
] as const;
export type Source = (typeof SOURCES)[number];

export const PAID_SOURCES: Source[] = ["Meta Ads", "Google"];

// ---------- Pacientes ----------
export interface PatientNote {
  id: ID;
  text: string;
  authorName: string;
  createdAt: ISODate;
}

export interface Patient {
  id: ID;
  clinicId: ID;
  cpf: string; // somente dígitos, único por clínica
  name: string;
  phone: string; // somente dígitos com DDI, ex 5511999990000
  email: string;
  birthDate: string; // yyyy-MM-dd
  insurance: Insurance;
  source: Source;
  notes: PatientNote[];
  tags: ID[];
  /** pediu para não receber campanhas (respondeu SAIR) — LGPD */
  optOut?: boolean;
  /** responsável legal (menores / curatela) */
  guardianId?: ID;
  guardianRelation?: string;
  createdAt: ISODate;
}

// ---------- Organização ----------
export interface Tag {
  id: ID;
  name: string;
  color: string;
}

export type PatientStatus = "novo" | "em_tratamento" | "ativo" | "em_risco" | "inativo" | "vip";

export interface SegmentFilters {
  q?: string;
  status?: PatientStatus | "";
  tagId?: ID | "";
  insurance?: string;
}

export interface Segment {
  id: ID;
  name: string;
  filters: SegmentFilters;
}

export interface TreatmentPlan {
  id: ID;
  clinicId: ID;
  patientId: ID;
  professionalId: ID;
  procedureId: ID;
  title: string;
  totalSessions: number;
  /** intervalo esperado entre sessões */
  frequencyDays: number;
  status: "ativo" | "concluido" | "interrompido";
  createdAt: ISODate;
}

export interface Task {
  id: ID;
  clinicId: ID;
  title: string;
  dueDate: string; // yyyy-MM-dd
  done: boolean;
  assignedUserId?: ID;
  patientId?: ID;
  leadId?: ID;
  createdAt: ISODate;
}

export interface WaitlistEntry {
  id: ID;
  clinicId: ID;
  patientId: ID;
  professionalId?: ID;
  procedureId: ID;
  preferredPeriod: string;
  notes?: string;
  createdAt: ISODate;
}

// ---------- WhatsApp ----------
export interface WhatsAppInstance {
  id: ID;
  clinicId: ID;
  name: string; // "Recepção", "Estética"
  phone: string;
  department: string;
  status: "conectado" | "desconectado" | "aguardando_qr";
  color: string;
}

export type Queue = "ia" | "novo" | "em_atendimento" | "aguardando" | "finalizado";
export type Handler = "ia" | "humano";

export interface HandoffCard {
  interest: string;
  procedureId?: ID;
  complaint: string;
  urgency: "baixa" | "media" | "alta";
  insurance: string;
  preferredPeriod: string;
  isReturningPatient: boolean;
  summary: string;
  createdAt: ISODate;
}

export interface Conversation {
  id: ID;
  clinicId: ID;
  instanceId: ID;
  contactName: string;
  phone: string;
  leadId?: ID;
  patientId?: ID;
  queue: Queue;
  handler: Handler;
  assignedUserId?: ID;
  department: string;
  handoff?: HandoffCard;
  unread: number;
  lastMessageAt: ISODate;
  createdAt: ISODate;
  closedAt?: ISODate;
  /** conversa aberta pela resposta a uma campanha */
  campaignId?: ID;
}

export type MessageAuthor = "contato" | "ia" | "atendente" | "sistema";

export interface Message {
  id: ID;
  conversationId: ID;
  author: MessageAuthor;
  authorName?: string;
  text: string;
  createdAt: ISODate;
  kind?: "texto" | "link_agendamento" | "agendamento";
}

// ---------- Funil ----------
export type LeadStage =
  | "novo"
  | "qualificacao"
  | "orcamento"
  | "agendado"
  | "realizado"
  | "perdido";

export interface Lead {
  id: ID;
  clinicId: ID;
  name: string;
  phone: string;
  source: Source;
  stage: LeadStage;
  interest: string;
  estimatedValue: number;
  patientId?: ID;
  conversationId?: ID;
  budgetId?: ID;
  appointmentId?: ID;
  lostReason?: string;
  ownerUserId?: ID;
  /** minutos até a primeira resposta humana (métrica da equipe) */
  firstResponseMin?: number;
  /** pediu para não receber campanhas (respondeu SAIR) */
  optOut?: boolean;
  /** lead perdido que voltou ao funil por resposta a uma campanha */
  recoveredByCampaignId?: ID;
  createdAt: ISODate;
  stageChangedAt: ISODate;
}

// ---------- Agenda ----------
export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "compareceu"
  | "faltou"
  | "cancelado";

export interface Appointment {
  id: ID;
  clinicId: ID;
  patientId: ID;
  professionalId: ID;
  procedureId: ID;
  start: ISODate;
  durationMin: number;
  status: AppointmentStatus;
  value: number;
  leadId?: ID;
  notes?: string;
  modality?: "presencial" | "online";
  /** confirmação automática via WhatsApp no dia anterior */
  confirmation?: "enviada" | "confirmou" | "cancelou" | "sem_resposta";
  createdAt: ISODate;
}

// ---------- Financeiro ----------
export interface BudgetItem {
  procedureId: ID;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Budget {
  id: ID;
  clinicId: ID;
  patientId?: ID;
  leadId?: ID;
  items: BudgetItem[];
  total: number;
  status: "aberto" | "aprovado" | "recusado";
  createdAt: ISODate;
}

export type PaymentMethod = "Pix" | "Cartão de crédito" | "Cartão de débito" | "Dinheiro" | "Convênio" | "Boleto";

export interface Transaction {
  id: ID;
  clinicId: ID;
  type: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
  date: ISODate;
  method: PaymentMethod;
  patientId?: ID;
  appointmentId?: ID;
}

// ---------- Configuração do agente de IA ----------
export interface AiAgentConfig {
  enabled: boolean;
  name: string;
  persona: string;
  tone: "acolhedor" | "profissional" | "descontraido";
  triageQuestions: string[];
  handoffRules: string[];
  workingHoursOnly: boolean;
  sendBookingLink: boolean;
}

// ---------- Campanhas ----------

export type CampaignChannel = "whatsapp" | "email" | "sms";
export type CampaignStatus = "rascunho" | "agendada" | "enviando" | "concluida" | "pausada" | "cancelada";
export type CampaignAudience =
  | "todos_leads_perdidos"
  | "leads_sem_resposta"
  | "pacientes_inativos"
  | "segmento_personalizado"
  | "lista_manual";

export interface CampaignMessage {
  /** Texto da mensagem; use {{nome}}, {{clinica}}, {{data}} como variáveis */
  text: string;
  /** Delay em minutos após o envio anterior (para sequências) */
  delayMin?: number;
}

export interface Campaign {
  id: ID;
  clinicId: ID;
  name: string;
  description?: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  audience: CampaignAudience;
  /** ID do Segment quando audience = "segmento_personalizado" */
  segmentId?: ID;
  /** IDs manuais de pacientes/leads quando audience = "lista_manual" */
  manualTargets?: ID[];
  messages: CampaignMessage[];
  /** ISO 8601 — quando deve ser disparada (null = imediata ao lançar) */
  scheduledAt?: ISODate;
  /** ISO 8601 — quando foi realmente lançada */
  sentAt?: ISODate;
  /** Totais (recalculados a partir de `recipients` a cada lote enviado) */
  stats?: {
    total: number;
    sent: number;
    delivered: number;
    replied: number;
    converted: number; // virou agendamento (atribuição de 14 dias)
  };
  /** Destinatários resolvidos no lançamento (um por telefone) */
  recipients?: CampaignRecipient[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type RecipientStatus = "pendente" | "entregue" | "falhou" | "respondeu" | "optout";

export interface CampaignRecipient {
  kind: "patient" | "lead";
  targetId: ID;
  /** paciente vinculado (para atribuir agendamentos) */
  patientId?: ID;
  name: string;
  phone: string;
  status: RecipientStatus;
  sentAt?: ISODate;
  reply?: string;
  /** conversa criada no Atendimento quando o contato responde */
  conversationId?: ID;
}

/** Janela de atribuição: agendamento criado até N dias após o envio conta como conversão. */
export const CAMPAIGN_ATTRIBUTION_DAYS = 14;
/** Proteção contra excesso de mensagens: não reenvia para quem recebeu campanha neste período. */
export const CAMPAIGN_COOLDOWN_DAYS = 7;
