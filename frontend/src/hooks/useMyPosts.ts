import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { toQueryString } from "@/lib/queryString";
import type { ManagePostsParams, PostListData } from "@/types/post";

/** GET /api/users/me/posts — 마이페이지 (본인 글, DRAFT 포함, 제목 검색/상태 필터). 로그인 상태에서만 조회한다. */
export function useMyPosts(params: ManagePostsParams = {}) {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  return useQuery({
    queryKey: ["myPosts", params],
    queryFn: () =>
      apiFetch<PostListData>(`/api/users/me/posts${toQueryString(params)}`, { accessToken }),
    enabled: status === "authenticated" && Boolean(accessToken),
  });
}
