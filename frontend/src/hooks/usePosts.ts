import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toQueryString } from "@/lib/queryString";
import type { ListPostsParams, PostListData } from "@/types/post";

/** GET /api/posts — 공개 게시글 목록 (페이지네이션/카테고리/태그/검색/정렬) */
export function usePosts(params: ListPostsParams = {}) {
  return useQuery({
    queryKey: ["posts", params],
    queryFn: () => apiFetch<PostListData>(`/api/posts${toQueryString(params)}`),
  });
}
