import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import type { ListPostsParams, PostListData } from "@/types/post";

function toQueryString(params: ListPostsParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** GET /api/users/me/posts — 마이페이지 (본인 글, DRAFT 포함). 로그인 상태에서만 조회한다. */
export function useMyPosts(params: Omit<ListPostsParams, "authorId"> = {}) {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  return useQuery({
    queryKey: ["myPosts", params],
    queryFn: () =>
      apiFetch<PostListData>(`/api/users/me/posts${toQueryString(params)}`, { accessToken }),
    enabled: status === "authenticated" && Boolean(accessToken),
  });
}
