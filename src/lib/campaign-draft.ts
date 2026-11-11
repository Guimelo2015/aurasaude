"use client";

import { create } from "zustand";
import type { Campaign } from "./types";

/**
 * Rascunho de campanha vindo de outras telas (Funil, Pacientes, Relatórios, Dashboard).
 * A tela /campanhas lê o rascunho ao abrir e já mostra o assistente preenchido.
 */
export type CampaignDraft = Partial<Omit<Campaign, "id" | "clinicId" | "createdAt" | "updatedAt">> & { id?: string };

export const useCampaignDraft = create<{ draft: CampaignDraft | null; setDraft: (d: CampaignDraft | null) => void }>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));

export function openCampaignDraft(push: (href: string) => void, draft: CampaignDraft) {
  useCampaignDraft.getState().setDraft(draft);
  push("/campanhas");
}
