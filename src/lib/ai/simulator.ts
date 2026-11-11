"use client";

import { create } from "zustand";
import { useApp } from "../store";
import { respond, DEMO_SCRIPTS } from "./triage-agent";
import type { ID, Source } from "../types";
import { onlyDigits } from "../utils";

/**
 * Orquestra o agente simulado. Em produção isto roda no servidor:
 * webhook da Evolution API → fila → agente (Claude) → resposta via Evolution API.
 */

export const useTyping = create<{ typing: Record<ID, boolean>; set: (id: ID, v: boolean) => void }>((set) => ({
  typing: {},
  set: (id, v) => set((s) => ({ typing: { ...s.typing, [id]: v } })),
}));

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function aiTurn(conversationId: ID) {
  const st = useApp.getState();
  const conv = st.conversations.find((c) => c.id === conversationId);
  if (!conv || conv.handler !== "ia" || !st.aiConfig.enabled) return;

  useTyping.getState().set(conversationId, true);
  await wait(1200 + Math.random() * 1200);
  useTyping.getState().set(conversationId, false);

  const fresh = useApp.getState();
  const c = fresh.conversations.find((x) => x.id === conversationId);
  if (!c || c.handler !== "ia") return; // humano assumiu durante a "digitação"

  const result = respond({
    contactName: c.contactName,
    messages: fresh.messages.filter((m) => m.conversationId === conversationId),
    config: fresh.aiConfig,
    procedures: fresh.procedures,
    knownPatient: fresh.patients.find((p) => p.id === c.patientId),
  });

  if (result.reply) fresh.sendMessage(conversationId, result.reply, "ia");
  if (result.closing) fresh.sendMessage(conversationId, result.closing, "ia");
  if (result.closingExtra) {
    await wait(700);
    useApp.getState().sendMessage(conversationId, result.closingExtra, "ia");
  }
  if (result.handoff) {
    await wait(500);
    useApp.getState().handoffConversation(conversationId, result.handoff);
  }
}

/** Mensagem "recebida do paciente" (no protótipo, digitada pelo usuário). */
export async function simulateIncoming(conversationId: ID, text: string) {
  useApp.getState().sendMessage(conversationId, text, "contato");
  await aiTurn(conversationId);
}

/** Cria um novo contato chegando pelo WhatsApp, já com lead no funil. */
export function createIncomingContact(data: { name: string; phone: string; source: Source; instanceId: string }) {
  const st = useApp.getState();
  const phone = onlyDigits(data.phone);
  const existing = st.patients.find((p) => p.phone === phone);
  const inst = st.instances.find((i) => i.id === data.instanceId) ?? st.instances[0];
  const lead = st.addLead({
    name: existing?.name ?? data.name,
    phone,
    source: data.source,
    stage: "novo",
    interest: "A definir (triagem IA)",
    estimatedValue: 0,
    patientId: existing?.id,
  });
  const conv = st.addConversation({
    instanceId: inst.id,
    department: inst.department,
    contactName: existing?.name ?? data.name,
    phone,
    patientId: existing?.id,
    leadId: lead.id,
    queue: "ia",
    handler: st.aiConfig.enabled ? "ia" : "humano",
    unread: 0,
    lastMessageAt: new Date().toISOString(),
  });
  if (!st.aiConfig.enabled) st.setQueue(conv.id, "novo");
  st.updateLead(lead.id, { conversationId: conv.id });
  return conv;
}

/** Roda um roteiro completo (paciente ↔ IA) até o handoff. */
export async function runDemoScript(index: number, onCreated?: (id: ID) => void) {
  const script = DEMO_SCRIPTS[index % DEMO_SCRIPTS.length];
  const conv = createIncomingContact(script);
  onCreated?.(conv.id);
  for (const line of script.lines) {
    await wait(900);
    const c = useApp.getState().conversations.find((x) => x.id === conv.id);
    if (!c || c.handler !== "ia") return;
    await simulateIncoming(conv.id, line);
  }
}
