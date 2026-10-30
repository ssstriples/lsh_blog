import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** 브라우저(localStorage)에만 보관하는 작성 중 원고 — 서버의 "임시저장(DRAFT)"과는 별개다. */
export interface PostDraft {
  title: string;
  slug: string;
  categoryId: string;
  tags: string[];
  thumbnailUrl: string | null;
  content: string;
  /** 저장 시각 (ms) */
  savedAt: number;
}

interface DraftState {
  /** key: `${userId}:new` (새 글) 또는 `${userId}:${postId}` (수정 중인 글) */
  drafts: Record<string, PostDraft>;
  saveDraft: (key: string, draft: PostDraft) => void;
  clearDraft: (key: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      saveDraft: (key, draft) => set((state) => ({ drafts: { ...state.drafts, [key]: draft } })),
      clearDraft: (key) =>
        set((state) => {
          const drafts = { ...state.drafts };
          delete drafts[key];
          return { drafts };
        }),
    }),
    {
      name: "lsh-blog-post-drafts",
      storage: createJSONStorage(() => localStorage),
      // SSR 단계에는 localStorage가 없다 — 클라이언트 마운트 후 rehydrate()를 직접 호출한다.
      skipHydration: true,
    },
  ),
);
