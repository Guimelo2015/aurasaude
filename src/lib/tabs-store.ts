import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MAX_TABS = 10; // além do Dashboard, que é fixo

export interface OpenTab {
  key: string; // caminho (uma aba por caminho)
  href: string; // URL completa: seção, filtros, registro aberto
  used: number;
}

interface TabsState {
  tabs: OpenTab[];
  open: (key: string, href: string) => void;
  close: (key: string) => void;
  closeAll: () => void;
}

export const useTabs = create<TabsState>()(
  persist(
    (set) => ({
      tabs: [],
      open: (key, href) =>
        set((s) => {
          const now = Date.now();
          const exists = s.tabs.some((t) => t.key === key);
          let tabs = exists ? s.tabs.map((t) => (t.key === key ? { ...t, href, used: now } : t)) : [...s.tabs, { key, href, used: now }];
          // passou do limite: fecha a mais antiga não usada (nunca a ativa)
          while (tabs.length > MAX_TABS) {
            const victim = tabs.filter((t) => t.key !== key).sort((a, b) => a.used - b.used)[0];
            tabs = tabs.filter((t) => t !== victim);
          }
          return { tabs };
        }),
      close: (key) => set((s) => ({ tabs: s.tabs.filter((t) => t.key !== key) })),
      closeAll: () => set({ tabs: [] }),
    }),
    { name: "aura-tabs", version: 2, migrate: () => ({ tabs: [] }) as unknown as TabsState },
  ),
);
