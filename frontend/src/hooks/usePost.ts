import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PostDetail } from "@/types/post";

/** GET /api/posts/:slug — 게시글 상세 (조회수 증가 포함) */
export function usePost(slug: string) {
  return useQuery({
    queryKey: ["post", slug],
    queryFn: () => apiFetch<PostDetail>(`/api/posts/${slug}`),
    enabled: Boolean(slug),
  });
}
