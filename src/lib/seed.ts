import { addDays, addMinutes, setHours, setMinutes, startOfDay, subDays, subMinutes, subMonths, formatISO, format } from "date-fns";
import type {
  AiAgentConfig,
  Appointment,
  AppointmentStatus,
  Budget,
  Campaign,
  CampaignRecipient,
  Clinic,
  Conversation,
  Insurance,
  Lead,
  LeadStage,
  Message,
  Patient,
  PaymentMethod,
  Procedure,
  Professional,
  Segment,
  Source,
  Tag,
  Task,
  Transaction,
  TreatmentPlan,
  User,
  WaitlistEntry,
  WhatsAppInstance,
} from "./types";
import { fakeCPF, mulberry32 } from "./utils";

export interface DataState {
  clinic: Clinic;
  users: User[];
  professionals: Professional[];
  procedures: Procedure[];
  instances: WhatsAppInstance[];
  patients: Patient[];
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  appointments: Appointment[];
  budgets: Budget[];
  transactions: Transaction[];
  aiConfig: AiAgentConfig;
  tags: Tag[];
  segments: Segment[];
  plans: TreatmentPlan[];
  tasks: Task[];
  waitlist: WaitlistEntry[];
  campaigns: Campaign[];
}

const CLINIC_ID = "clinic_equilibrio";
export const CLINIC_SHORT = "Instituto Equilíbrio";
const iso = (d: Date) => formatISO(d);

const FIRST_F = ["Ana", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda", "Gabriela", "Helena", "Isabela", "Juliana", "Larissa", "Mariana", "Natália", "Patrícia", "Rafaela", "Sofia", "Tatiane", "Vanessa", "Aline", "Bruna", "Carolina", "Letícia", "Renata", "Luana", "Priscila"];
const FIRST_M = ["André", "Bruno", "Carlos", "Diego", "Eduardo", "Felipe", "Gustavo", "Henrique", "Igor", "João", "Lucas", "Marcelo", "Nicolas", "Otávio", "Pedro", "Rafael", "Rodrigo", "Thiago", "Vinícius", "Leonardo", "Mateus", "Gabriel", "Paulo", "Ricardo", "Fábio"];
const KIDS = ["Theo", "Miguel", "Arthur", "Davi", "Heitor", "Bernardo", "Alice", "Laura", "Valentina", "Manuela", "Cecília", "Lorena", "Benício", "Lívia", "Enzo", "Maitê"];
const LAST = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
  "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
  "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas",
  "Cardoso", "Ramos", "Teixeira", "Castro", "Araújo", "Campos", "Prado", "Nogueira", "Farias", "Duarte",
];

export const DEFAULT_AI_CONFIG: AiAgentConfig = {
  enabled: true,
  name: "Sofia",
  persona:
    "Você é a Sofia, da recepção do Instituto Equilíbrio. Acolha com empatia, sem julgamentos e com frases curtas — como uma pessoa real, nunca como robô. Você NÃO dá orientação clínica, diagnóstico nem fala de medicação. Entenda o motivo do contato, colete as informações de triagem e passe para a equipe finalizar o agendamento. Se houver qualquer menção a risco de vida, autolesão ou ideação suicida, priorize a segurança: informe o CVV (188) e o SAMU (192) e transfira imediatamente.",
  tone: "acolhedor",
  triageQuestions: [
    "O que motivou a procura (com as palavras do paciente)?",
    "Já faz ou fez acompanhamento psiquiátrico/psicológico? Usa medicação?",
    "Já é paciente da clínica?",
    "Convênio, particular ou particular com reembolso?",
    "Prefere atendimento presencial ou online? Qual período?",
  ],
  handoffRules: [
    "Menção a risco de vida, autolesão ou ideação suicida → protocolo de segurança (CVV 188 / SAMU 192) e transferência IMEDIATA com prioridade alta",
    "Paciente menor de idade → confirmar responsável legal e transferir",
    "Pedido de receita, laudo ou atestado → transferir (a IA nunca trata de medicação)",
    "Paciente pediu para falar com uma pessoa → transferir imediatamente",
    "Triagem completa → gerar card de resumo e enviar para a fila 'Novos'",
  ],
  workingHoursOnly: false,
  sendBookingLink: true,
};

export function buildSeed(now = new Date()): DataState {
  const rand = mulberry32(20261110);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const weighted = <T,>(items: [T, number][]) => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [v, w] of items) {
      if ((r -= w) <= 0) return v;
    }
    return items[0][0];
  };
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  let seq = 0;
  const id = (p: string) => `${p}_${(++seq).toString(36)}`;

  const clinic: Clinic = { id: CLINIC_ID, name: "Instituto Equilíbrio — Psiquiatria e Saúde Mental", city: "São Paulo - SP" };

  const professionals: Professional[] = [
    { id: "prof_ricardo", clinicId: CLINIC_ID, name: "Dr. Ricardo Albuquerque", specialty: "Psiquiatria (adultos)", council: "CRM-SP 112.345", color: "#0f9d8f" },
    { id: "prof_marina", clinicId: CLINIC_ID, name: "Dra. Marina Teles", specialty: "Psiquiatria infantojuvenil", council: "CRM-SP 128.770", color: "#3b82f6" },
    { id: "prof_paula", clinicId: CLINIC_ID, name: "Paula Neves", specialty: "Psicologia (TCC) e Neuropsicologia", council: "CRP 06/154321", color: "#d9469f" },
    { id: "prof_felipe", clinicId: CLINIC_ID, name: "Dr. Felipe Andrade", specialty: "Psiquiatria e Neuromodulação (EMT)", council: "CRM-SP 101.904", color: "#f59e0b" },
  ];

  const users: User[] = [
    { id: "user_admin", clinicId: CLINIC_ID, name: "Dr. Henrique Vasconcelos", email: "henrique@institutoequilibrio.com.br", role: "admin", active: true },
    { id: "user_recep1", clinicId: CLINIC_ID, name: "Aline Moraes", email: "aline@institutoequilibrio.com.br", role: "recepcao", active: true },
    { id: "user_recep2", clinicId: CLINIC_ID, name: "Thiago Lima", email: "thiago@institutoequilibrio.com.br", role: "recepcao", active: true },
    { id: "user_ricardo", clinicId: CLINIC_ID, name: "Dr. Ricardo Albuquerque", email: "ricardo@institutoequilibrio.com.br", role: "profissional", professionalId: "prof_ricardo", active: true },
    { id: "user_paula", clinicId: CLINIC_ID, name: "Paula Neves", email: "paula@institutoequilibrio.com.br", role: "profissional", professionalId: "prof_paula", active: true },
  ];

  const P = (id: string, name: string, category: Procedure["category"], price: number, durationMin: number): Procedure => ({
    id, clinicId: CLINIC_ID, name, category, price, durationMin,
  });
  const procedures: Procedure[] = [
    P("proc_primeira", "Primeira consulta psiquiátrica", "Consulta", 650, 60),
    P("proc_retorno", "Retorno psiquiátrico", "Consulta", 450, 30),
    P("proc_infanto", "Consulta psiquiátrica infantojuvenil", "Consulta", 700, 60),
    P("proc_tele", "Teleconsulta psiquiátrica", "Consulta", 450, 30),
    P("proc_psico", "Sessão de psicoterapia (TCC)", "Psicoterapia", 250, 50),
    P("proc_casal", "Terapia de casal", "Psicoterapia", 350, 60),
    P("proc_neuro", "Avaliação neuropsicológica (pacote)", "Avaliação", 2800, 90),
    P("proc_tdah", "Avaliação de TDAH adulto", "Avaliação", 1600, 90),
    P("proc_emt", "Sessão de EMT (estimulação magnética)", "Neuromodulação", 380, 30),
    P("proc_laudo", "Relatório / laudo médico", "Documentos", 350, 30),
  ];
  const proc = (pid: string) => procedures.find((p) => p.id === pid)!;

  const profProcs: Record<string, [string, number][]> = {
    prof_ricardo: [["proc_primeira", 3], ["proc_retorno", 9], ["proc_tele", 3], ["proc_laudo", 0.6], ["proc_tdah", 0.5]],
    prof_marina: [["proc_infanto", 4], ["proc_retorno", 5], ["proc_tele", 1]],
    prof_paula: [["proc_psico", 12], ["proc_casal", 2], ["proc_neuro", 0.4]],
    prof_felipe: [["proc_emt", 9], ["proc_primeira", 2], ["proc_retorno", 4]],
  };

  const instances: WhatsAppInstance[] = [
    { id: "wa_recepcao", clinicId: CLINIC_ID, name: "Recepção", phone: "5511940028922", department: "Recepção", status: "conectado", color: "#0f9d8f" },
    { id: "wa_terapias", clinicId: CLINIC_ID, name: "Terapias & Avaliações", phone: "5511951237788", department: "Terapias", status: "conectado", color: "#d9469f" },
  ];

  const tags: Tag[] = [
    { id: "tag_receita", name: "Receita controlada", color: "#dc3b3b" },
    { id: "tag_tdah", name: "TDAH", color: "#f59e0b" },
    { id: "tag_ansiedade", name: "Ansiedade", color: "#8b5cf6" },
    { id: "tag_depressao", name: "Depressão", color: "#3b82f6" },
    { id: "tag_reembolso", name: "Pede reembolso", color: "#0f9d8f" },
    { id: "tag_online", name: "Prefere online", color: "#64748b" },
    { id: "tag_indicou", name: "Indicou pacientes", color: "#16a34a" },
    { id: "tag_menor", name: "Menor de idade", color: "#d9469f" },
  ];

  const segments: Segment[] = [
    { id: "seg_1", name: "Receita controlada em risco de abandono", filters: { status: "em_risco", tagId: "tag_receita" } },
    { id: "seg_2", name: "Pacientes VIP", filters: { status: "vip" } },
    { id: "seg_3", name: "Inativos que pedem reembolso", filters: { status: "inativo", tagId: "tag_reembolso" } },
    { id: "seg_4", name: "TDAH em tratamento", filters: { status: "em_tratamento", tagId: "tag_tdah" } },
  ];

  const sourceWeights: [Source, number][] = [
    ["Instagram", 20], ["Meta Ads", 18], ["Google", 26], ["Indicação", 28], ["Site", 6], ["Passante", 2],
  ];
  const insuranceWeights: [Insurance, number][] = [
    ["Particular", 40], ["Particular (reembolso)", 22], ["Unimed", 12], ["Bradesco Saúde", 9], ["SulAmérica Saúde", 8], ["Amil", 6], ["Porto Saúde", 3],
  ];

  const usedNames = new Set<string>();
  const newName = (first?: readonly string[]) => {
    for (;;) {
      const f = first ? pick(first) : rand() < 0.55 ? pick(FIRST_F) : pick(FIRST_M);
      const n = `${f} ${pick(LAST)}${rand() < 0.35 ? " " + pick(LAST) : ""}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };
  const newPhone = () => `55119${between(6000, 9999)}${between(1000, 9999)}`;
  const emailOf = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ").slice(0, 2).join(".") +
    pick(["@gmail.com", "@hotmail.com", "@outlook.com", "@yahoo.com.br"]);

  // ---------- Pacientes adultos ----------
  interface PMeta { p: Patient; activeFrom: Date; activeUntil: Date; kid: boolean }
  const pmeta: PMeta[] = [];
  const patients: Patient[] = [];
  const clinicalTags = ["tag_receita", "tag_tdah", "tag_ansiedade", "tag_depressao"];
  for (let i = 0; i < 175; i++) {
    const name = newName();
    const inactive = rand() < 0.27;
    const created = inactive ? subDays(now, between(330, 720)) : subDays(now, between(20, 720));
    const activeUntil = inactive ? subDays(now, between(95, 320)) : addDays(now, 60);
    const birth = subDays(subMonths(now, between(19, 68) * 12), between(0, 364));
    const insurance = weighted(insuranceWeights);
    const t = new Set<string>();
    if (rand() < 0.75) t.add(pick(clinicalTags));
    if (rand() < 0.25) t.add(pick(clinicalTags));
    if (insurance === "Particular (reembolso)") t.add("tag_reembolso");
    if (rand() < 0.15) t.add("tag_online");
    if (rand() < 0.08) t.add("tag_indicou");
    const p: Patient = {
      id: id("pac"), clinicId: CLINIC_ID, cpf: fakeCPF(rand), name, phone: newPhone(), email: emailOf(name),
      birthDate: iso(birth).slice(0, 10), insurance, source: weighted(sourceWeights), notes: [], tags: [...t], createdAt: iso(created),
    };
    if (rand() < 0.3) {
      p.notes.push({
        id: id("note"),
        text: pick([
          "Prefere ser chamada(o) pelo nome social — conferir antes da consulta.",
          "Prefere horários no início da manhã, antes do trabalho.",
          "Ansioso(a) em sala de espera: chamar assim que chegar.",
          "Solicita nota fiscal detalhada (CID e CRM) para reembolso.",
          "Indicou 2 pessoas da família para a clínica.",
          "Faz teleconsulta quando está viajando a trabalho.",
          "Pagamento sempre via Pix, pede recibo por e-mail.",
        ]),
        authorName: pick(["Aline Moraes", "Thiago Lima"]),
        createdAt: iso(addDays(created, between(1, 15))),
      });
    }
    patients.push(p);
    pmeta.push({ p, activeFrom: created, activeUntil, kid: false });
  }

  // ---------- Crianças/adolescentes com responsável legal ----------
  const adults = [...pmeta];
  for (let i = 0; i < 30; i++) {
    const guardian = adults[Math.floor(rand() * adults.length)];
    const last = guardian.p.name.split(" ").slice(-1)[0];
    let name = `${pick(KIDS)} ${pick(LAST)} ${last}`;
    while (usedNames.has(name)) name = `${pick(KIDS)} ${pick(LAST)} ${last}`;
    usedNames.add(name);
    const created = subDays(now, between(20, 600));
    const inactive = rand() < 0.2;
    const t = ["tag_menor"];
    if (rand() < 0.6) t.push("tag_tdah");
    else if (rand() < 0.5) t.push("tag_ansiedade");
    const p: Patient = {
      id: id("pac"), clinicId: CLINIC_ID, cpf: fakeCPF(rand), name, phone: guardian.p.phone, email: guardian.p.email,
      birthDate: iso(subDays(subMonths(now, between(6, 16) * 12), between(0, 364))).slice(0, 10),
      insurance: guardian.p.insurance, source: "Indicação", notes: [], tags: t,
      guardianId: guardian.p.id, guardianRelation: guardian.p.name.split(" ")[0].endsWith("a") ? "Mãe" : "Pai",
      createdAt: iso(created),
    };
    patients.push(p);
    pmeta.push({ p, activeFrom: created, activeUntil: inactive ? subDays(now, between(95, 250)) : addDays(now, 60), kid: true });
  }

  // ---------- Agenda (12 meses para trás + 21 dias à frente) ----------
  const appointments: Appointment[] = [];
  const transactions: Transaction[] = [];
  const today0 = startOfDay(now);
  const methodFor = (ins: Insurance): PaymentMethod =>
    !ins.startsWith("Particular") && rand() < 0.7
      ? "Convênio"
      : weighted<PaymentMethod>([["Pix", 50], ["Cartão de crédito", 35], ["Cartão de débito", 10], ["Dinheiro", 5]]);
  const noShowWeight: Record<string, number> = { prof_paula: 15, prof_ricardo: 10, prof_marina: 7, prof_felipe: 5 };

  for (let d = -365; d <= 21; d++) {
    const day = addDays(today0, d);
    const dow = day.getDay();
    if (dow === 0) continue;
    const saturday = dow === 6;
    const growth = 0.75 + ((d + 365) / 386) * 0.45;

    for (const prof of professionals) {
      if (saturday && prof.id !== "prof_paula" && prof.id !== "prof_ricardo") continue;
      const base = saturday ? 2 : prof.id === "prof_paula" ? 5 : prof.id === "prof_felipe" ? 4 : prof.id === "prof_marina" ? 2 : 4;
      const count = Math.max(0, Math.round((base + rand() * 2.2 - 0.8) * growth * (d > 7 ? 0.5 : 1)));
      let cursor = setMinutes(setHours(day, 8), 0);
      const endHour = saturday ? 12 : 20;

      for (let k = 0; k < count; k++) {
        cursor = addMinutes(cursor, between(0, 3) * 30);
        const procedure = proc(weighted(profProcs[prof.id]));
        if (cursor.getHours() + procedure.durationMin / 60 > endHour) break;
        if (cursor.getHours() === 12) cursor = setHours(cursor, 13);

        const wantKid = prof.id === "prof_marina";
        const candidates = pmeta.filter((m) => m.kid === wantKid && m.activeFrom <= day && m.activeUntil >= day);
        if (!candidates.length) break;
        const pm = candidates[Math.floor(rand() * candidates.length)];
        const start = cursor;
        const isPast = start < now;
        let status: AppointmentStatus;
        let confirmation: Appointment["confirmation"];
        if (isPast) {
          status = weighted<AppointmentStatus>([["compareceu", 82], ["faltou", noShowWeight[prof.id]], ["cancelado", 6]]);
          confirmation = status === "compareceu" ? "confirmou" : undefined;
        } else if (d === 0) {
          status = weighted<AppointmentStatus>([["confirmado", 80], ["agendado", 20]]);
          confirmation = status === "confirmado" ? "confirmou" : "sem_resposta";
        } else if (d === 1) {
          // amanhã: a maioria ainda sem confirmação → demonstra a confirmação automática
          status = weighted<AppointmentStatus>([["agendado", 85], ["confirmado", 15]]);
          confirmation = status === "confirmado" ? "confirmou" : undefined;
        } else {
          status = weighted<AppointmentStatus>([["agendado", 80], ["confirmado", 20]]);
          confirmation = status === "confirmado" ? "confirmou" : undefined;
        }
        const covered = !pm.p.insurance.startsWith("Particular") && ["Consulta", "Psicoterapia"].includes(procedure.category);
        const value = covered ? Math.round(procedure.price * 0.55) : procedure.price;
        const online = procedure.id === "proc_tele" || (["proc_retorno", "proc_psico"].includes(procedure.id) && (pm.p.tags.includes("tag_online") ? rand() < 0.7 : rand() < 0.1));
        const apt: Appointment = {
          id: id("apt"), clinicId: CLINIC_ID, patientId: pm.p.id, professionalId: prof.id, procedureId: procedure.id,
          start: iso(start), durationMin: procedure.durationMin, status, value, confirmation,
          modality: online ? "online" : "presencial",
          createdAt: iso(subDays(start, between(1, 20))),
        };
        appointments.push(apt);
        if (status === "compareceu") {
          transactions.push({
            id: id("trx"), clinicId: CLINIC_ID, type: "entrada", category: procedure.category,
            description: `${procedure.name} — ${pm.p.name}`, amount: value, date: iso(addMinutes(start, procedure.durationMin)),
            method: methodFor(pm.p.insurance), patientId: pm.p.id, appointmentId: apt.id,
          });
        }
        cursor = addMinutes(start, procedure.durationMin);
      }
    }
  }

  // ---------- Despesas mensais ----------
  for (let m = 11; m >= 0; m--) {
    const ref = new Date(subMonths(today0, m).getFullYear(), subMonths(today0, m).getMonth(), 1);
    const exp: [string, string, number, number][] = [
      ["Aluguel", "Aluguel das salas", 11200, 5],
      ["Folha de pagamento", "Salários equipe (recepção + administrativo)", 14800, 5],
      ["Repasse profissionais", "Repasse de honorários (psicologia)", 9800 + between(-1500, 2000), 10],
      ["Equipamentos", "Manutenção do equipamento de EMT", 2400, 12],
      ["Marketing", "Meta Ads + Google Ads", 5200, 1],
      ["Software", "Sistemas, prontuário e assinaturas", 990, 8],
      ["Utilidades", "Energia, água e internet", 1700 + between(-200, 400), 15],
    ];
    for (const [category, description, amount, day] of exp) {
      const date = new Date(ref.getFullYear(), ref.getMonth(), day, 10);
      if (date > now) continue;
      transactions.push({
        id: id("trx"), clinicId: CLINIC_ID, type: "saida", category, description, amount, date: iso(date),
        method: category === "Folha de pagamento" || category === "Repasse profissionais" ? "Pix" : "Boleto",
      });
    }
  }

  // ---------- Planos de tratamento (derivados do histórico) ----------
  const plans: TreatmentPlan[] = [];
  const planDefs: { procId: string; min: number; title: string; total: number; freq: number }[] = [
    { procId: "proc_emt", min: 4, title: "Protocolo EMT — 30 sessões", total: 30, freq: 3 },
    { procId: "proc_psico", min: 6, title: "Psicoterapia TCC — 24 sessões", total: 24, freq: 7 },
    { procId: "proc_retorno", min: 4, title: "Acompanhamento psiquiátrico — 12 meses", total: 12, freq: 30 },
  ];
  for (const pm of pmeta) {
    const done = appointments.filter((a) => a.patientId === pm.p.id && a.status === "compareceu");
    for (const def of planDefs) {
      const sessions = done.filter((a) => a.procedureId === def.procId).sort((a, b) => a.start.localeCompare(b.start));
      if (sessions.length < def.min || plans.length >= 90) continue;
      const last = new Date(sessions[sessions.length - 1].start);
      const quiet = (now.getTime() - last.getTime()) / 86400000 > def.freq * 2;
      // parte de quem parou na verdade concluiu o plano; o restante ficou com poucas sessões pendentes
      const finished = quiet && rand() < 0.6;
      const total = finished ? sessions.length : quiet ? sessions.length + between(2, 6) : Math.max(def.total, sessions.length + between(2, 8));
      plans.push({
        id: id("plan"), clinicId: CLINIC_ID, patientId: pm.p.id, professionalId: sessions[0].professionalId, procedureId: def.procId,
        title: def.title.replace(/— \d+ sessões/, `— ${total} sessões`), totalSessions: total, frequencyDays: def.freq,
        status: finished ? "concluido" : rand() < 0.05 ? "interrompido" : "ativo", createdAt: sessions[0].start,
      });
      break; // um plano por paciente
    }
  }

  // ---------- Leads ----------
  const leads: Lead[] = [];
  const budgets: Budget[] = [];
  const conv: Record<Source, number> = { "Indicação": 0.6, "Google": 0.42, "Instagram": 0.28, "Meta Ads": 0.22, "Site": 0.35, "Passante": 0.4 };
  const interestPool: [string, string, number][] = [
    ["Primeira consulta psiquiátrica", "proc_primeira", 5], ["Psicoterapia", "proc_psico", 5], ["Avaliação de TDAH adulto", "proc_tdah", 3],
    ["Psiquiatria infantil", "proc_infanto", 3], ["Avaliação neuropsicológica", "proc_neuro", 2], ["EMT para depressão", "proc_emt", 2],
    ["Teleconsulta psiquiátrica", "proc_tele", 3], ["Terapia de casal", "proc_casal", 1], ["Renovação de receita", "proc_retorno", 2],
  ];
  const valueFor = (pid: string) => (pid === "proc_emt" ? proc(pid).price * 20 : pid === "proc_psico" ? 1000 : pid === "proc_casal" ? 1400 : proc(pid).price);
  const pickInterest = () => {
    const [label, pid] = weighted(interestPool.map((x) => [x, x[2]] as [[string, string, number], number]));
    return { label, pid };
  };
  const lostReasons = ["Achou caro / não aceita o convênio", "Sem resposta após orçamento", "Escolheu outro profissional", "Sem horário compatível", "Só queria saber valores"];
  const owners: [string, number][] = [["user_recep1", 1], ["user_recep2", 1]];
  const responseTime = (owner: string) => (owner === "user_recep1" ? between(2, 12) : between(6, 30));

  for (let i = 0; i < 260; i++) {
    const source = weighted(sourceWeights);
    const created = subDays(now, between(22, 180));
    const { label, pid } = pickInterest();
    const owner = weighted(owners);
    const won = rand() < conv[source] + (owner === "user_recep1" ? 0.07 : -0.03);
    leads.push({
      id: id("lead"), clinicId: CLINIC_ID, name: newName(), phone: newPhone(), source, stage: won ? "realizado" : "perdido",
      interest: label, estimatedValue: valueFor(pid), lostReason: won ? undefined : pick(lostReasons),
      ownerUserId: owner, firstResponseMin: responseTime(owner),
      createdAt: iso(created), stageChangedAt: iso(addDays(created, between(1, 18))),
    });
  }

  const activeStages: [LeadStage, number][] = [["novo", 7], ["qualificacao", 7], ["orcamento", 9], ["agendado", 8], ["realizado", 6], ["perdido", 5]];
  for (const [stage, qty] of activeStages) {
    for (let i = 0; i < qty; i++) {
      const source = weighted(sourceWeights);
      const created = stage === "novo" ? subMinutes(now, between(20, 60 * 30)) : subDays(now, between(1, 20));
      const { label, pid } = pickInterest();
      const pr = proc(pid);
      const ageDays = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86400000));
      const stageChanged = stage === "novo" ? created : addDays(created, Math.min(between(0, 6), ageDays));
      const value = valueFor(pid);
      const owner = stage === "novo" ? undefined : weighted(owners);
      const lead: Lead = {
        id: id("lead"), clinicId: CLINIC_ID, name: newName(), phone: newPhone(), source, stage, interest: label, estimatedValue: value,
        lostReason: stage === "perdido" ? pick(lostReasons) : undefined, ownerUserId: owner, firstResponseMin: owner ? responseTime(owner) : undefined,
        createdAt: iso(created), stageChangedAt: iso(stageChanged),
      };
      if (stage === "orcamento" || stage === "agendado" || stage === "realizado" || (stage === "perdido" && rand() < 0.6)) {
        const qty = Math.max(1, Math.round(value / pr.price));
        const b: Budget = {
          id: id("orc"), clinicId: CLINIC_ID, leadId: lead.id,
          items: [{ procedureId: pid, description: pr.name, qty, unitPrice: pr.price }], total: qty * pr.price,
          status: stage === "orcamento" ? "aberto" : stage === "perdido" ? "recusado" : "aprovado", createdAt: iso(addDays(created, 1)),
        };
        budgets.push(b);
        lead.budgetId = b.id;
      }
      if (stage === "agendado" || stage === "realizado") {
        const pat: Patient = {
          id: id("pac"), clinicId: CLINIC_ID, cpf: fakeCPF(rand), name: lead.name, phone: lead.phone, email: emailOf(lead.name),
          birthDate: iso(subDays(subMonths(now, between(20, 60) * 12), between(0, 364))).slice(0, 10),
          insurance: weighted(insuranceWeights), source, notes: [], tags: [], createdAt: lead.createdAt,
        };
        patients.push(pat);
        lead.patientId = pat.id;
        const profId = Object.entries(profProcs).find(([, list]) => list.some(([p]) => p === pid))?.[0] ?? "prof_ricardo";
        const start =
          stage === "agendado"
            ? setMinutes(setHours(addDays(today0, between(2, 9)), pick([9, 10, 14, 15, 16, 18])), pick([0, 30]))
            : setMinutes(setHours(subDays(today0, between(1, 6)), pick([9, 11, 14, 16])), 0);
        const apt: Appointment = {
          id: id("apt"), clinicId: CLINIC_ID, patientId: pat.id, professionalId: profId, procedureId: pid, start: iso(start),
          durationMin: pr.durationMin, status: stage === "agendado" ? "agendado" : "compareceu", value: pr.price, leadId: lead.id,
          modality: pid === "proc_tele" ? "online" : "presencial", createdAt: lead.stageChangedAt,
        };
        appointments.push(apt);
        lead.appointmentId = apt.id;
        if (stage === "realizado") {
          transactions.push({
            id: id("trx"), clinicId: CLINIC_ID, type: "entrada", category: pr.category, description: `${pr.name} — ${pat.name}`,
            amount: pr.price, date: iso(addMinutes(start, pr.durationMin)), method: "Pix", patientId: pat.id, appointmentId: apt.id,
          });
        }
      }
      leads.push(lead);
    }
  }

  // orçamentos de pacientes da base
  for (const pm of pmeta.slice(0, 50)) {
    const pr = proc(pick(["proc_neuro", "proc_tdah", "proc_emt", "proc_casal"]));
    const qty = pr.id === "proc_emt" ? 20 : 1;
    budgets.push({
      id: id("orc"), clinicId: CLINIC_ID, patientId: pm.p.id, items: [{ procedureId: pr.id, description: pr.name, qty, unitPrice: pr.price }],
      total: qty * pr.price, status: weighted([["aprovado", 55], ["recusado", 25], ["aberto", 20]]), createdAt: iso(subDays(now, between(10, 300))),
    });
  }

  // ---------- Cadastros duplicados (para demonstrar a unificação) ----------
  const dupSources = pmeta.filter((m) => !m.kid && m.p.name.split(" ").length >= 3).slice(3, 6);
  for (const src of dupSources) {
    const parts = src.p.name.split(" ");
    const variant = `${parts[0]} ${parts[1][0]}. ${parts.slice(2).join(" ")}`;
    patients.push({
      ...src.p, id: id("pac"), name: variant, cpf: fakeCPF(rand), email: src.p.email.replace("@", "1@"), notes: [], tags: [],
      createdAt: iso(subDays(now, between(3, 40))),
    });
  }

  // ---------- Conversas do WhatsApp ----------
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  const recurring = patients.filter((p) => !p.guardianId && appointments.some((a) => a.patientId === p.id && new Date(a.start) < now)).slice(5, 10);

  type Line = [Message["author"], string, number];
  const mkConv = (
    opts: Partial<Conversation> & Pick<Conversation, "contactName" | "phone" | "queue" | "handler" | "instanceId">,
    lines: Line[],
    leadStage?: LeadStage,
    leadSource: Source = "Instagram",
    leadInterest?: string,
    leadValue = 0,
  ) => {
    const cid = id("conv");
    const firstAt = subMinutes(now, lines[0][2]);
    const lastAt = subMinutes(now, lines[lines.length - 1][2]);
    const c: Conversation = {
      id: cid, clinicId: CLINIC_ID, department: instances.find((i) => i.id === opts.instanceId)!.department, unread: 0,
      createdAt: iso(firstAt), lastMessageAt: iso(lastAt), ...opts,
    };
    if (leadStage) {
      const l: Lead = {
        id: id("lead"), clinicId: CLINIC_ID, name: c.contactName, phone: c.phone, source: leadSource, stage: leadStage,
        interest: leadInterest ?? c.handoff?.interest ?? "Primeira consulta psiquiátrica", estimatedValue: leadValue,
        patientId: c.patientId, conversationId: cid, ownerUserId: c.assignedUserId, createdAt: iso(firstAt), stageChangedAt: iso(lastAt),
      };
      leads.push(l);
      c.leadId = l.id;
    }
    lines.forEach(([author, text, mins]) =>
      messages.push({
        id: id("msg"), conversationId: cid, author, text, createdAt: iso(subMinutes(now, mins)),
        authorName: author === "ia" ? "Sofia (IA)" : author === "atendente" ? users.find((u) => u.id === c.assignedUserId)?.name ?? "Aline Moraes" : undefined,
        kind: text.startsWith("📅") ? "agendamento" : text.includes("aura.app/agendar") ? "link_agendamento" : "texto",
      }),
    );
    conversations.push(c);
    return c;
  };

  // IA atendendo
  mkConv(
    { contactName: "Mariana Lopes", phone: "5511987654321", queue: "ia", handler: "ia", instanceId: "wa_terapias", unread: 1 },
    [
      ["contato", "Oi, boa tarde. Vocês fazem avaliação de TDAH em adulto?", 6],
      ["ia", "Oi Mariana, boa tarde! Fazemos sim 😊 Aqui é a Sofia, do Instituto Equilíbrio. Posso te fazer algumas perguntinhas pra te direcionar ao profissional certo?", 6],
      ["contato", "Pode sim", 5],
      ["ia", "Obrigada! Me conta com suas palavras: o que te fez pensar em fazer a avaliação?", 4],
      ["contato", "Desde a faculdade perco prazos, esqueço tudo, começo mil coisas e não termino. Tá afetando meu trabalho", 1],
    ],
    "qualificacao", "Google", "Avaliação de TDAH adulto", 1600,
  );
  mkConv(
    { contactName: "Pedro Henrique Duarte", phone: "5511976543210", queue: "ia", handler: "ia", instanceId: "wa_recepcao", unread: 1 },
    [
      ["contato", "bom dia, vcs atendem unimed pra psiquiatra?", 3],
      ["ia", "Bom dia, Pedro! Atendemos Unimed sim 🙂 Me conta, o que te trouxe a procurar um psiquiatra?", 3],
      ["contato", "faz uns 2 meses que nao consigo dormir direito, acordo varias vezes de madrugada", 1],
    ],
    "novo", "Google", "Primeira consulta psiquiátrica", 650,
  );

  // Novos (handoff feito)
  mkConv(
    {
      contactName: "Lucas Almeida", phone: "5511954321098", queue: "novo", handler: "humano", instanceId: "wa_recepcao", unread: 2,
      handoff: {
        interest: "Primeira consulta psiquiátrica (acolhimento)", procedureId: "proc_primeira",
        complaint: "Relata sofrimento intenso, choro frequente e sensação de \"não estar aguentando mais\" há algumas semanas.",
        urgency: "alta", insurance: "Particular", preferredPeriod: "O quanto antes", isReturningPatient: false,
        summary: "PROTOCOLO DE SEGURANÇA aplicado: CVV 188 e SAMU 192 informados. Negou risco imediato quando perguntado, mas precisa de contato humano AGORA e avaliação de encaixe hoje com o Dr. Ricardo.",
        createdAt: iso(subMinutes(now, 8)),
      },
    },
    [
      ["contato", "preciso de ajuda, nao to aguentando mais, nao consigo parar de chorar", 12],
      ["ia", "Lucas, obrigada por ter escrito pra gente. Sinto muito que você esteja passando por isso. Você está em um lugar seguro agora?", 12],
      ["contato", "acho que sim, to em casa", 10],
      ["ia", "Que bom. Vou chamar agora mesmo uma pessoa da nossa equipe pra conversar com você e ver um horário o quanto antes, tá?", 9],
      ["ia", "E se em algum momento você sentir que pode se machucar, ligue 188 (CVV, 24h e gratuito) ou 192 (SAMU). Você não precisa passar por isso sozinho 💚", 8],
      ["sistema", "Prioridade ALTA • Protocolo de segurança • Sofia (IA) transferiu para a fila Novos Atendimentos", 8],
      ["contato", "obrigado", 7],
    ],
    "qualificacao", "Google", "Primeira consulta psiquiátrica", 650,
  );
  mkConv(
    {
      contactName: "Fernanda Castro", phone: "5511965432109", queue: "novo", handler: "humano", instanceId: "wa_recepcao", unread: 1,
      handoff: {
        interest: "Primeira consulta psiquiátrica", procedureId: "proc_tele",
        complaint: "Crises de ansiedade no trabalho há cerca de 4 meses, com taquicardia e falta de ar. Nunca fez acompanhamento.",
        urgency: "media", insurance: "Particular (reembolso)", preferredPeriod: "Online, após as 18h", isReturningPatient: false,
        summary: "Prefere teleconsulta à noite. Perguntou sobre nota fiscal com CID para reembolso do plano. Boa candidata a psiquiatria + psicoterapia.",
        createdAt: iso(subMinutes(now, 25)),
      },
    },
    [
      ["contato", "Olá! Queria marcar com um psiquiatra, ando tendo crises de ansiedade", 40],
      ["ia", "Oi Fernanda! Que bom que você procurou ajuda 💚 Aqui é a Sofia, do Instituto Equilíbrio. Você já fez algum acompanhamento antes?", 39],
      ["contato", "Nunca. Começou no trabalho, umas crises com coração acelerado e falta de ar. Faz uns 4 meses", 35],
      ["ia", "Entendi, obrigada por me contar. Você prefere consulta presencial ou online? E seria particular ou pelo convênio?", 34],
      ["contato", "Online, depois das 18h. Particular, mas quero pedir reembolso. Vocês dão nota com CID?", 27],
      ["ia", "Damos sim, com todos os dados pro reembolso. Vou passar pra Aline da nossa equipe confirmar um horário à noite com você 😊", 25],
      ["sistema", "Sofia (IA) concluiu a triagem e transferiu para a fila Novos Atendimentos", 25],
    ],
    "qualificacao", "Instagram", "Teleconsulta psiquiátrica", 450,
  );
  mkConv(
    {
      contactName: "Beatriz Nogueira", phone: "5511943210987", queue: "novo", handler: "humano", instanceId: "wa_terapias", unread: 1,
      handoff: {
        interest: "Psiquiatria infantil (filho de 9 anos)", procedureId: "proc_infanto",
        complaint: "Escola relatou desatenção e agitação do filho Theo, 9 anos. Pediram avaliação para TDAH.",
        urgency: "baixa", insurance: "Bradesco Saúde", preferredPeriod: "Manhã", isReturningPatient: false,
        summary: "Mãe (responsável legal) entrando em contato. Indicado: consulta com Dra. Marina + possível avaliação neuropsicológica. Pediu relatório para a escola.",
        createdAt: iso(subMinutes(now, 47)),
      },
    },
    [
      ["contato", "Oi! A escola pediu uma avaliação de TDAH pro meu filho, vocês atendem criança?", 58],
      ["ia", "Oi Beatriz! Atendemos sim, com a Dra. Marina, nossa psiquiatra infantojuvenil 😊 Quantos anos ele tem?", 57],
      ["contato", "9 anos. A professora disse que ele não para quieto e não presta atenção", 52],
      ["ia", "Entendi. Você seria a responsável que vai acompanhar a consulta? E é pelo convênio ou particular?", 50],
      ["contato", "Sim, sou a mãe. Temos Bradesco Saúde. De manhã é melhor", 48],
      ["sistema", "Sofia (IA) concluiu a triagem e transferiu para a fila Novos Atendimentos", 47],
    ],
    "qualificacao", "Indicação", "Psiquiatria infantil", 700,
  );

  // Em atendimento
  mkConv(
    {
      contactName: "Carlos Eduardo Ramos", phone: "5511932109876", queue: "em_atendimento", handler: "humano", instanceId: "wa_recepcao", assignedUserId: "user_recep1", unread: 1,
      handoff: { interest: "EMT para depressão", procedureId: "proc_emt", complaint: "Depressão há 3 anos, já tentou 2 medicações sem melhora. O psiquiatra dele indicou EMT.", urgency: "media", insurance: "Particular", preferredPeriod: "Manhã", isReturningPatient: false, summary: "Encaminhado por outro psiquiatra. Pediu valor do protocolo completo e parcelamento.", createdAt: iso(subMinutes(now, 190)) },
    },
    [
      ["contato", "Bom dia, meu psiquiatra indicou a estimulação magnética. Quanto custa?", 200],
      ["ia", "Bom dia, Carlos! Que bom que você está buscando novas possibilidades de tratamento 💚 Quem faz a EMT aqui é o Dr. Felipe. Vou chamar a equipe pra te passar os detalhes.", 199],
      ["sistema", "Sofia (IA) concluiu a triagem e transferiu para a fila Novos Atendimentos", 190],
      ["sistema", "Aline Moraes assumiu o atendimento", 120],
      ["atendente", "Oi Carlos, aqui é a Aline! O protocolo padrão é de 20 sessões (R$ 380 cada, total R$ 7.600), em até 10x. Antes, o Dr. Felipe faz uma consulta de avaliação. Quer agendar?", 118],
      ["contato", "Tem horário na quinta de manhã pra consulta com o Dr. Felipe?", 4],
    ],
    "orcamento", "Indicação", "EMT para depressão", 7600,
  );
  mkConv(
    { contactName: "Ana Clara Souza", phone: "5511921098765", queue: "em_atendimento", handler: "humano", instanceId: "wa_terapias", assignedUserId: "user_recep2", unread: 0 },
    [
      ["contato", "Oi, queria começar terapia. Vocês têm horário à noite?", 300],
      ["ia", "Oi Ana Clara! Temos sim 😊 Você já fez terapia antes ou seria a primeira vez?", 299],
      ["contato", "Fiz há uns anos, quero voltar", 290],
      ["sistema", "Thiago Lima assumiu o atendimento", 60],
      ["atendente", "Oi Ana! Aqui é o Thiago. A Paula atende até as 20h. Te mandei o link pra escolher o horário que for melhor: https://aura.app/agendar/equilibrio", 58],
    ],
    "qualificacao", "Instagram", "Psicoterapia", 1000,
  );

  // Aguardando paciente
  mkConv(
    { contactName: "Roberto Farias", phone: "5511910987654", queue: "aguardando", handler: "humano", instanceId: "wa_terapias", assignedUserId: "user_recep1" },
    [
      ["contato", "Qual o valor da avaliação neuropsicológica?", 4400],
      ["sistema", "Aline Moraes assumiu o atendimento", 4380],
      ["atendente", "Oi Roberto! A avaliação neuropsicológica completa fica R$ 2.800 (4 a 5 encontros + laudo), em até 6x. Posso reservar a primeira sessão?", 4370],
      ["atendente", "Oi Roberto, tudo bem? Conseguiu ver a proposta? Ainda temos horário essa semana 😊", 200],
    ],
    "orcamento", "Meta Ads", "Avaliação neuropsicológica", 2800,
  );
  if (recurring[0]) {
    const p = recurring[0];
    mkConv(
      { contactName: p.name, phone: p.phone, patientId: p.id, queue: "aguardando", handler: "humano", instanceId: "wa_recepcao", assignedUserId: "user_recep2" },
      [["atendente", `Olá ${p.name.split(" ")[0]}! Passando pra lembrar do seu retorno amanhã às 10h com o Dr. Ricardo. Podemos confirmar? Responda SIM para confirmar 😊`, 90]],
    );
  }

  // Finalizados
  if (recurring[1]) {
    const p = recurring[1];
    mkConv(
      { contactName: p.name, phone: p.phone, patientId: p.id, queue: "finalizado", handler: "humano", instanceId: "wa_recepcao", assignedUserId: "user_recep1", closedAt: iso(subMinutes(now, 1300)) },
      [
        ["contato", "Oi, minha receita tá acabando, preciso marcar retorno", 1400],
        ["ia", `Oi ${p.name.split(" ")[0]}! Vou te ajudar com isso 😊 Como envolve receita, já vou passar pra nossa equipe agendar seu retorno.`, 1399],
        ["sistema", "Aline Moraes assumiu o atendimento", 1390],
        ["atendente", "📅 Agendamento confirmado: Retorno psiquiátrico com Dr. Ricardo Albuquerque", 1310],
        ["contato", "Perfeito, obrigada!", 1305],
        ["sistema", "Atendimento encerrado por Aline Moraes", 1300],
      ],
    );
  }
  mkConv(
    { contactName: "Larissa Martins", phone: "5511998761234", queue: "finalizado", handler: "humano", instanceId: "wa_terapias", assignedUserId: "user_recep2", closedAt: iso(subMinutes(now, 2900)) },
    [
      ["contato", "Quanto custa a terapia de casal?", 3000],
      ["ia", "Oi Larissa! A sessão de terapia de casal é R$ 350, com duração de 1 hora 😊 Vocês já fizeram terapia juntos antes?", 2999],
      ["contato", "Não, só estou pesquisando por enquanto, obrigada", 2950],
      ["sistema", "Atendimento encerrado por Thiago Lima", 2900],
    ],
    "perdido", "Instagram", "Terapia de casal", 1400,
  );
  const lostLead = leads.find((l) => l.name === "Larissa Martins");
  if (lostLead) lostLead.lostReason = "Só queria saber valores";

  // ---------- Tarefas da equipe ----------
  const d = (n: number) => format(addDays(today0, n), "yyyy-MM-dd");
  const adultsP = pmeta.filter((m) => !m.kid).map((m) => m.p);
  const kid = pmeta.find((m) => m.kid)?.p;
  const tasks: Task[] = [
    { id: id("task"), clinicId: CLINIC_ID, title: "Ligar para Roberto Farias sobre a proposta de avaliação neuropsicológica", dueDate: d(-1), done: false, assignedUserId: "user_recep1", createdAt: iso(subDays(now, 3)) },
    { id: id("task"), clinicId: CLINIC_ID, title: `Enviar nota fiscal com CID para reembolso — ${adultsP[2].name}`, dueDate: d(0), done: false, assignedUserId: "user_recep2", patientId: adultsP[2].id, createdAt: iso(subDays(now, 1)) },
    { id: id("task"), clinicId: CLINIC_ID, title: `Pedir ao Dr. Ricardo o relatório médico solicitado por ${adultsP[7].name}`, dueDate: d(0), done: false, assignedUserId: "user_recep1", patientId: adultsP[7].id, createdAt: iso(subDays(now, 2)) },
    { id: id("task"), clinicId: CLINIC_ID, title: kid ? `Retornar contato da escola de ${kid.name.split(" ")[0]} (relatório Dra. Marina)` : "Retornar contato da escola", dueDate: d(0), done: false, assignedUserId: "user_recep2", patientId: kid?.id, createdAt: iso(subDays(now, 1)) },
    { id: id("task"), clinicId: CLINIC_ID, title: "Conferir guias de autorização Unimed da semana", dueDate: d(1), done: false, assignedUserId: "user_recep1", createdAt: iso(now) },
    { id: id("task"), clinicId: CLINIC_ID, title: "Revisar agenda de EMT do próximo mês com o Dr. Felipe", dueDate: d(3), done: false, assignedUserId: "user_admin", createdAt: iso(now) },
  ];

  // ---------- Lista de espera ----------
  const waitlist: WaitlistEntry[] = [
    { id: id("wait"), clinicId: CLINIC_ID, patientId: adultsP[11].id, professionalId: "prof_ricardo", procedureId: "proc_retorno", preferredPeriod: "Qualquer horário", notes: "Receita acaba em 5 dias", createdAt: iso(subDays(now, 2)) },
    { id: id("wait"), clinicId: CLINIC_ID, patientId: adultsP[14].id, professionalId: "prof_paula", procedureId: "proc_psico", preferredPeriod: "Noite", notes: "Quer adiantar a sessão", createdAt: iso(subDays(now, 4)) },
    { id: id("wait"), clinicId: CLINIC_ID, patientId: adultsP[18].id, professionalId: "prof_ricardo", procedureId: "proc_primeira", preferredPeriod: "Manhã", createdAt: iso(subDays(now, 1)) },
    { id: id("wait"), clinicId: CLINIC_ID, patientId: adultsP[22].id, professionalId: "prof_felipe", procedureId: "proc_emt", preferredPeriod: "Manhã", notes: "Iniciar protocolo o quanto antes", createdAt: iso(subDays(now, 6)) },
  ];

  // ---------- Campanhas ----------
  // camp_001 já foi enviada há 5 dias para os leads perdidos: os resultados são reais
  // (destinatários, respostas, leads que voltaram ao funil e agendamentos atribuídos).
  const sent1 = subDays(now, 5);
  const seenPhones = new Set<string>();
  const lostAtSend = leads.filter((l) => l.stage === "perdido" && new Date(l.stageChangedAt) <= sent1 && !seenPhones.has(l.phone) && seenPhones.add(l.phone));
  const recipients1: CampaignRecipient[] = [];
  let converted = 0;
  for (const l of lostAtSend) {
    const sentAt = iso(addMinutes(sent1, Math.floor(recipients1.length / 6)));
    const r: CampaignRecipient = { kind: "lead", targetId: l.id, name: l.name, phone: l.phone, status: "entregue", sentAt };
    const x = rand();
    if (x < 0.07) r.status = "falhou";
    else if (x < 0.07 + 0.16) {
      if (rand() < 0.1) {
        r.status = "optout";
        r.reply = "SAIR";
        l.optOut = true;
      } else {
        r.status = "respondeu";
        const positive = rand() < 0.65;
        r.reply = positive ? "Oi! Tenho interesse sim, quais horários vocês têm?" : "Agora não, obrigado";
        if (positive) {
          l.recoveredByCampaignId = "camp_001";
          l.lostReason = undefined;
          l.stageChangedAt = iso(addDays(sent1, 1));
          if (converted < 3) {
            // virou paciente e agendou dentro da janela de atribuição
            converted++;
            const pr = proc(interestPool.find(([label]) => label === l.interest)?.[1] ?? "proc_primeira");
            const pat: Patient = {
              id: id("pac"), clinicId: CLINIC_ID, cpf: fakeCPF(rand), name: l.name, phone: l.phone, email: emailOf(l.name),
              birthDate: iso(subDays(subMonths(now, between(22, 55) * 12), between(0, 364))).slice(0, 10),
              insurance: weighted(insuranceWeights), source: l.source, notes: [], tags: [], createdAt: iso(addDays(sent1, 1)),
            };
            patients.push(pat);
            const profId = Object.entries(profProcs).find(([, list]) => list.some(([p]) => p === pr.id))?.[0] ?? "prof_ricardo";
            const apt: Appointment = {
              id: id("apt"), clinicId: CLINIC_ID, patientId: pat.id, professionalId: profId, procedureId: pr.id,
              start: iso(setMinutes(setHours(addDays(today0, between(2, 6)), pick([9, 11, 15, 17])), 30)), durationMin: pr.durationMin,
              status: "agendado", value: pr.price, leadId: l.id, modality: "presencial", notes: "Agendado após campanha de recuperação",
              createdAt: iso(addDays(sent1, between(1, 3))),
            };
            appointments.push(apt);
            Object.assign(l, { stage: "agendado", patientId: pat.id, appointmentId: apt.id });
            r.patientId = pat.id;
          } else l.stage = "qualificacao";
        }
      }
    }
    recipients1.push(r);
  }

  const campaigns: Campaign[] = [
    {
      id: "camp_001", clinicId: CLINIC_ID, name: "Recuperação de leads perdidos – Outubro", channel: "whatsapp", audience: "todos_leads_perdidos",
      description: "Nova tentativa com quem não fechou nos últimos meses.",
      messages: [
        { text: "Oi {{nome}}, tudo bem? Aqui é do {{clinica}} 💚 Há um tempo você falou com a gente e queríamos saber se ainda podemos te ajudar. Temos horários presenciais e online esta semana. Se não quiser mais receber mensagens, responda SAIR." },
      ],
      status: "concluida", sentAt: iso(sent1), recipients: recipients1, createdAt: iso(subDays(now, 8)), updatedAt: iso(sent1),
    },
    {
      id: "camp_002", clinicId: CLINIC_ID, name: "Reativação de pacientes inativos", channel: "whatsapp", audience: "pacientes_inativos",
      description: "Pacientes há mais de 60 dias sem consulta e sem nada agendado.",
      messages: [
        { text: "Oi {{nome}}, aqui é do {{clinica}} 💚 Sua última consulta foi em {{data}} e queremos saber como você está. Se fizer sentido retomar o acompanhamento, responda aqui que encontramos um horário (presencial ou online). Para não receber mais mensagens, responda SAIR." },
      ],
      status: "rascunho", createdAt: iso(subDays(now, 1)), updatedAt: iso(subDays(now, 1)),
    },
    {
      id: "camp_003", clinicId: CLINIC_ID, name: "Follow-up de leads parados – Novembro", channel: "whatsapp", audience: "leads_sem_resposta",
      messages: [
        { text: "Oi {{nome}}! Aqui é do {{clinica}}. Ficou alguma dúvida sobre valores, reembolso ou horários? Estou por aqui pra te ajudar 😊" },
        { text: "{{nome}}, só passando para lembrar que ainda temos horários esta semana. Se preferir, é só responder SAIR que não enviamos mais.", delayMin: 1440 },
      ],
      status: "agendada", scheduledAt: iso(addDays(now, 2)), createdAt: iso(subDays(now, 2)), updatedAt: iso(subDays(now, 2)),
    },
  ];

  return {
    clinic, users, professionals, procedures, instances, patients, leads, conversations, messages, appointments, budgets, transactions,
    aiConfig: DEFAULT_AI_CONFIG, tags, segments, plans, tasks, waitlist, campaigns,
  };
}
