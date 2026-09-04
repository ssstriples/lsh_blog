import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Tag } from "@/types/taxonomy";

/** GET /api/tags — 전체 태그 목록 (게시글 수 많은 순) */
export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<Tag[]>("/api/tags"),
  });
}
