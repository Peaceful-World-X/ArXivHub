import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "./i18n";
import { DEFAULT_FAVORITES } from "./tools";
import { assignFavoriteHues } from "./card-colors";

export type HistoryItem = {
  id: string;
  title: string;
  at: number;
};

type HubState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  pinned: string[];
  togglePin: (id: string) => void;
  favoriteHues: Record<string, number>;
  ensureFavoriteHues: () => void;
  toolOrders: Record<string, string[]>;
  setToolOrder: (category: string, ids: string[]) => void;
  resetToolOrder: (category: string) => void;
  history: HistoryItem[];
  pushHistory: (item: Omit<HistoryItem, "at">) => void;
  clearHistory: () => void;
};

export const useHub = create<HubState>()(
  persist(
    (set, get) => ({
      lang: "zh",
      setLang: (lang) => set({ lang }),
      pinned: DEFAULT_FAVORITES.map((tool) => tool.id),
      favoriteHues: {},
      ensureFavoriteHues: () => set((state) => ({ favoriteHues: assignFavoriteHues(state.pinned, state.favoriteHues) })),
      toolOrders: {},
      setToolOrder: (category, ids) => set((state) => ({ toolOrders: { ...state.toolOrders, [category]: [...new Set(ids)] } })),
      resetToolOrder: (category) => set((state) => {
        const toolOrders = { ...state.toolOrders };
        delete toolOrders[category];
        return { toolOrders };
      }),
      togglePin: (id) => {
        const pinned = get().pinned;
        set({
          favoriteHues: assignFavoriteHues([...pinned, id], get().favoriteHues),
          pinned: pinned.includes(id)
            ? pinned.filter((x) => x !== id)
            : [id, ...pinned],
        });
      },
      history: [],
      pushHistory: (item) => {
        const next = [
          { ...item, at: Date.now() },
          ...get().history.filter((h) => h.id !== item.id),
        ].slice(0, 16);
        set({ history: next });
      },
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "arxiv-hub",
      version: 3,
      onRehydrateStorage: () => (state) => state?.ensureFavoriteHues(),
      // 仅升级旧存储时补入预置收藏，之后用户取消的项目不会再次出现。
      migrate: (saved, version) => {
        const state = (saved ?? {}) as Partial<HubState>;
        const existing = Array.isArray(state.pinned) ? state.pinned.filter((id) => typeof id === "string") : [];
        return {
          ...state,
          toolOrders: state.toolOrders ?? {},
          pinned: version < 1 ? [...new Set([...DEFAULT_FAVORITES.map((tool) => tool.id), ...existing])] : existing,
        };
      },
    },
  ),
);
