import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

export interface AiStatus {
  enabled: boolean;
  model: string;
}

export interface AiDraft {
  title: string;
  summary: string;
  tags: string[];
  html: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

/** GET /api/admin/ai/status — 🛡️ 서버에 AI 키가 설정돼 있는지 (관리자일 때만 조회) */
export function useAiStatus() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user.role === "ADMIN";

  return useQuery({
    queryKey: ["aiStatus"],
    queryFn: () =>
      apiFetch<AiStatus>("/api/admin/ai/status", { accessToken: session?.accessToken }),
    enabled: status === "authenticated" && isAdmin,
    staleTime: 5 * 60 * 1000,
  });
}

/** POST /api/admin/ai/draft — 🛡️ 글감(+ 참고 자료) → 초안. 저장은 하지 않고 결과만 받는다. */
export function useGenerateAiDraft() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: (input: { idea: string; sourceDocument?: string }) =>
      apiFetch<AiDraft>("/api/admin/ai/draft", {
        method: "POST",
        body: JSON.stringify(input),
        accessToken: session?.accessToken,
      }),
  });
}
