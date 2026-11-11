import type { AiAgentConfig, HandoffCard, Message, Patient, Procedure, Source } from "../types";

/**
 * Agente de triagem — versão SIMULADA (regras + extração por palavras-chave),
 * ajustada para psiquiatria/saúde mental.
 *
 * Regras inegociáveis (valem também para a versão com Claude na fase 2):
 *  1. Risco de vida / autolesão → protocolo de segurança (CVV 188, SAMU 192) e handoff imediato.
 *  2. A IA nunca fala de diagnóstico ou medicação; receita/laudo → equipe humana.
 *  3. Menor de idade → confirma responsável legal.
 */

export interface TriageContext {
  contactName: string;
  messages: Message[];
  config: AiAgentConfig;
  procedures: Procedure[];
  knownPatient?: Patient;
}

export interface TriageResult {
  reply?: string;
  handoff?: HandoffCard;
  /** mensagens finais antes do handoff */
  closing?: string;
  closingExtra?: string;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CRISIS = /suicid|me matar|tirar (a )?minha (propria )?vida|nao quero mais viver|acabar com tudo|me machucar|me cortar|autoles|quero morrer|sumir de vez/;
const DISTRESS = /nao (to|estou|tô) aguentando|nao aguento mais|desesperad|crise de panico agora|nao consigo parar de chorar|chorando sem parar/;
const MINOR = /\b(meu|minha) (filho|filha|menino|menina)\b|\bcrianca\b|\badolescente\b|\banos de idade\b/;

const INTERESTS: { re: RegExp; label: string; procId: string; kind?: "minor" | "admin" }[] = [
  { re: /receita|renovar|remedio (ta |esta )?acabando|medicacao (ta |esta )?acabando/, label: "Renovação de receita", procId: "proc_retorno", kind: "admin" },
  { re: /laudo|atestado|relatorio/, label: "Relatório / laudo médico", procId: "proc_laudo", kind: "admin" },
  { re: /neuropsico/, label: "Avaliação neuropsicológica", procId: "proc_neuro" },
  { re: /\bemt\b|estimulacao magnetica|\btms\b/, label: "EMT (estimulação magnética)", procId: "proc_emt" },
  { re: /casal|relacionamento/, label: "Terapia de casal", procId: "proc_casal" },
  { re: /tdah|deficit de atencao|hiperativ|desatenc/, label: "Avaliação de TDAH adulto", procId: "proc_tdah" },
  { re: /terapia|psicolog|terapeuta/, label: "Psicoterapia", procId: "proc_psico" },
  { re: /ansiedad|ansios|panico|depress|triste|insonia|dormir|sono|psiquiatra|bipolar|\btoc\b|crise/, label: "Primeira consulta psiquiátrica", procId: "proc_primeira" },
];

const INSURANCE_MAP: [RegExp, string][] = [
  [/reembolso/, "Particular (reembolso)"],
  [/unimed/, "Unimed"],
  [/bradesco/, "Bradesco Saúde"],
  [/sul ?america/, "SulAmérica Saúde"],
  [/amil/, "Amil"],
  [/porto/, "Porto Saúde"],
  [/particular|nao tenho (convenio|plano)|sem (convenio|plano)/, "Particular"],
];

const PERIODS: [RegExp, string][] = [
  [/o quanto antes|urgente|hoje|agora/, "O quanto antes"],
  [/sabado/, "Sábado"],
  [/manha|cedo/, "Manhã"],
  [/tarde|depois do almoco/, "Tarde"],
  [/noite|depois das (18|19)|apos as (18|19)/, "Noite"],
  [/qualquer|tanto faz|flexivel/, "Flexível"],
];

export function extract(ctx: TriageContext) {
  const contactTexts = ctx.messages.filter((m) => m.author === "contato").map((m) => norm(m.text));
  const all = contactTexts.join(" \n ");
  const minor = MINOR.test(all);
  let interest = INTERESTS.find((i) => i.re.test(all));
  if (minor && (!interest || interest.procId === "proc_tdah" || interest.procId === "proc_primeira")) {
    interest = { re: MINOR, label: "Psiquiatria infantojuvenil", procId: "proc_infanto", kind: "minor" };
  }
  const insurance = INSURANCE_MAP.find(([re]) => re.test(all))?.[1];
  const withoutGreetings = all.replace(/\b(bom dia|boa tarde|boa noite)\b/g, " ");
  const period = PERIODS.find(([re]) => re.test(withoutGreetings))?.[1];
  const modality = /online|teleconsulta|video|remot|a distancia/.test(all) ? "Online" : /presencial|na clinica|pessoalmente/.test(all) ? "Presencial" : undefined;
  const history = /nunca (fiz|tive|passei)/.test(all) ? "Nunca fez acompanhamento" : /ja (faco|fiz|fazia|tive|passei)|tomo (remedio|medicac)|uso (remedio|medicac)|faco tratamento/.test(all) ? "Já fez/faz acompanhamento" : undefined;
  const guardianConfirmed = /sou (a )?(mae|pai|responsavel)|sou o pai|sou a mae/.test(all);
  const returning = ctx.knownPatient ? true : /ja sou paciente|sou paciente|ja me consultei|ja fui ai/.test(all) ? true : /primeira vez|nunca fui/.test(all) ? false : undefined;
  const crisis = CRISIS.test(all);
  const distress = DISTRESS.test(all);
  const wantsHuman = /atendente|humano|falar com (uma )?pessoa|falar com alguem|robo/.test(all);
  // a queixa vai para o card com o texto original do paciente (com acentos)
  const rawTexts = ctx.messages.filter((m) => m.author === "contato").map((m) => m.text);
  const complaint = rawTexts.find((_, i) => /ansi|panico|depress|triste|dormir|sono|chor|aguent|esquec|atenc|escola|crise|prazo|tdah/.test(contactTexts[i]));
  return { interest, insurance, period, modality, history, guardianConfirmed, minor, returning, crisis, distress, wantsHuman, complaint, contactTexts };
}

const first = (name: string) => name.split(" ")[0];
const pickOne = <T,>(arr: T[], seed: number) => arr[seed % arr.length];

export const SAFETY_MESSAGE =
  "Se em algum momento você sentir que pode se machucar, ligue 188 (CVV, 24h e gratuito) ou 192 (SAMU). Você não precisa passar por isso sozinho(a) 💚";

export function respond(ctx: TriageContext): TriageResult {
  const x = extract(ctx);
  const n = first(ctx.contactName);
  const iaTurns = ctx.messages.filter((m) => m.author === "ia").length;
  const emoji = ctx.config.tone === "profissional" ? "" : " 😊";
  const proc = ctx.procedures.find((p) => p.id === x.interest?.procId);

  const buildCard = (): HandoffCard => {
    const urgency: HandoffCard["urgency"] = x.crisis || x.distress ? "alta" : x.interest?.kind === "admin" ? "media" : "baixa";
    const parts: string[] = [];
    if (x.crisis) parts.push("⚠️ MENÇÃO A RISCO — protocolo de segurança aplicado (CVV 188 / SAMU 192). Contato humano IMEDIATO.");
    else if (x.distress) parts.push("Sofrimento intenso relatado. Protocolo de segurança informado. Priorizar encaixe hoje.");
    if (x.minor) parts.push(x.guardianConfirmed ? "Contato é o responsável legal." : "Menor de idade — confirmar responsável legal.");
    if (x.interest?.kind === "admin") parts.push("Pedido administrativo (receita/documento) — a IA não trata de medicação.");
    if (x.history) parts.push(`${x.history}.`);
    if (x.returning) parts.push("Já tem cadastro na clínica.");
    else parts.push("Contato novo — criar cadastro (CPF) ao agendar.");
    if (x.insurance === "Particular (reembolso)") parts.push("Vai pedir reembolso: emitir NF com CID/CRM.");
    if (proc && proc.price >= 1000) parts.push(`Ticket alto (${proc.name}).`);
    if (x.wantsHuman) parts.push("Pediu para falar com uma pessoa.");
    const pref = [x.modality, x.period].filter(Boolean).join(" · ");
    return {
      interest: x.interest?.label ?? "Primeira consulta psiquiátrica",
      procedureId: x.interest?.procId ?? "proc_primeira",
      complaint: x.complaint ? x.complaint.charAt(0).toUpperCase() + x.complaint.slice(1) : "Não detalhou o motivo.",
      urgency,
      insurance: x.insurance ?? "Não informado",
      preferredPeriod: pref || (x.crisis || x.distress ? "O quanto antes" : "Não informado"),
      isReturningPatient: !!x.returning,
      summary: parts.join(" "),
      createdAt: new Date().toISOString(),
    };
  };
  const handoff = (closing: string, closingExtra?: string): TriageResult => ({ closing, closingExtra, handoff: buildCard() });

  // 1) Segurança em primeiro lugar
  if (x.crisis) {
    return handoff(
      `${n}, obrigada por confiar e falar com a gente. O que você está sentindo importa muito. Estou chamando agora mesmo uma pessoa da nossa equipe pra falar com você.`,
      SAFETY_MESSAGE,
    );
  }
  if (x.distress && iaTurns === 0) {
    return { reply: `${n}, obrigada por ter escrito pra gente. Sinto muito que você esteja passando por isso. Você está em um lugar seguro agora?` };
  }
  if (x.distress) {
    return handoff(`Obrigada por me contar. Vou chamar agora uma pessoa da nossa equipe pra conversar com você e ver um horário o quanto antes, tá?`, SAFETY_MESSAGE);
  }

  // 2) Pediu humano
  if (x.wantsHuman) return handoff(`Claro, ${n}! Vou chamar alguém da nossa equipe pra continuar com você. Só um instantinho${emoji}`);

  // 3) Saudação
  if (iaTurns === 0) {
    const greet = `Oi ${n}! Aqui é a ${ctx.config.name}, do Instituto Equilíbrio${emoji}`;
    if (x.interest?.kind === "admin") {
      return handoff(`${greet} Como envolve ${x.interest.procId === "proc_laudo" ? "documentos médicos" : "receita"}, vou passar direto pra nossa equipe resolver com o médico, tá? Já já te respondem.`);
    }
    if (x.minor) return { reply: `${greet} Atendemos crianças e adolescentes com a Dra. Marina, nossa psiquiatra infantojuvenil. Você é o(a) responsável legal que vai acompanhar a consulta?` };
    if (x.interest) {
      return { reply: `${greet} Que bom que você procurou ajuda 💚 Posso te fazer algumas perguntas rápidas pra te direcionar ao profissional certo? Você já fez algum acompanhamento psiquiátrico ou psicológico antes?` };
    }
    return { reply: `${greet} Como posso te ajudar? Pode me contar com suas palavras o que te fez procurar a clínica.` };
  }

  // 4) Coleta sequencial — cada pergunta é feita no máximo uma vez (sem loop se a resposta não for entendida)
  const iaTexts = ctx.messages.filter((m) => m.author === "ia").map((m) => norm(m.text)).join(" \n ");
  const asked = (marker: string) => iaTexts.includes(marker);

  if (!x.interest && !asked("me direciono melhor") && !asked("avaliacao especifica")) {
    return { reply: pickOne([`Entendi. Pode me contar um pouquinho mais do que você está sentindo ou buscando? Assim te direciono melhor${emoji}`, `Obrigada. Você procura psiquiatra, terapia (psicólogo) ou alguma avaliação específica?`], iaTurns) };
  }
  if (x.minor && !x.guardianConfirmed && !asked("responsavel legal")) return { reply: `Só pra confirmar: você é a mãe, o pai ou o responsável legal?` };
  if (!x.minor && !x.history && x.interest?.procId !== "proc_casal" && !asked("acompanhamento psiquiatrico ou psicologico")) {
    return { reply: `Obrigada por compartilhar. Você já faz ou já fez acompanhamento psiquiátrico ou psicológico antes?` };
  }
  if (!x.minor && x.returning === undefined && !x.history && !asked("paciente aqui da clinica")) {
    return { reply: `E você já é paciente aqui da clínica ou seria sua primeira vez com a gente?` };
  }
  if (!x.insurance && !asked("particular com reembolso")) {
    const priceHint = proc && proc.price >= 1000 ? " Temos parcelamento em até 10x no cartão." : "";
    return { reply: `Perfeito.${priceHint} Seria pelo convênio, particular ou particular com reembolso? (Emitimos nota fiscal com todos os dados pro reembolso)` };
  }
  if (!x.modality && !x.period && !asked("presencial ou online")) {
    return { reply: `Anotado${emoji} Você prefere atendimento presencial ou online? E qual período fica melhor: manhã, tarde ou noite?` };
  }

  // 5) Triagem completa
  const who = proc?.id === "proc_infanto" ? "a Dra. Marina" : proc?.category === "Psicoterapia" || proc?.id === "proc_neuro" ? "a Paula" : proc?.id === "proc_emt" ? "o Dr. Felipe" : "o Dr. Ricardo";
  return handoff(`Prontinho, ${n}! Já anotei tudo. Vou passar pra nossa equipe confirmar o melhor horário com ${who} e já te retornam por aqui${emoji}`);
}

/** Roteiros prontos para o botão "Simular novo contato". */
export const DEMO_SCRIPTS: { name: string; phone: string; source: Source; instanceId: string; title: string; lines: string[] }[] = [
  {
    name: "Juliana Ferraz",
    phone: "5511991234567",
    source: "Meta Ads",
    instanceId: "wa_recepcao",
    title: "Ansiedade · primeira consulta",
    lines: ["Oi! Vi o anúncio de vocês. Ando muito ansiosa, queria marcar com um psiquiatra", "Nunca fiz acompanhamento", "Particular, mas vou pedir reembolso", "Online, à noite"],
  },
  {
    name: "Marcos Vinícius",
    phone: "5511992345678",
    source: "Google",
    instanceId: "wa_recepcao",
    title: "Sofrimento intenso · protocolo de segurança",
    lines: ["Boa noite, não tô aguentando mais, tô desesperado", "Tô em casa, minha esposa tá comigo"],
  },
  {
    name: "Renata Oliveira",
    phone: "5511993456789",
    source: "Indicação",
    instanceId: "wa_terapias",
    title: "Filho com suspeita de TDAH",
    lines: ["Olá! Meu filho de 10 anos tem muita dificuldade na escola, acham que é TDAH", "Sim, sou a mãe dele", "SulAmérica", "De manhã, presencial"],
  },
];
