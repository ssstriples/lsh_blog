import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toQueryString } from "@/lib/queryString";
import type { Pagination, PostSummary } from "@/types/post";

export interface SearchResultPost extends PostSummary {
  /** 검색어 주변 본문 미리보기 (태그 제거된 평문) */
  excerpt: string;
}

export interface SearchData {
  q: string;
  posts: SearchResultPost[];
  pagination: Pagination;
}

/** GET /api/search?q= — 검색어가 비어 있으면 요청하지 않는다 */
export function useSearch(params: { q: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => apiFetch<SearchData>(`/api/search${toQueryString(params)}`),
    enabled: params.q.trim().length > 0,
    // 다음 페이지를 불러오는 동안 이전 결과를 유지한다 (빈 화면 깜빡임 방지)
    placeholderData: keepPreviousData,
  });
}
