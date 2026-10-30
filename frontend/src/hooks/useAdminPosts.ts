import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { toQueryString } from "@/lib/queryString";
import type { AdminPostListData, ManagePostsParams } from "@/types/post";

/** GET /api/admin/posts — 🛡️ 전체 게시글 (모더레이션용, q=제목/작성자명 검색) */
export function useAdminPosts(params: ManagePostsParams = {}) {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  return useQuery({
    queryKey: ["adminPosts", params],
    queryFn: () =>
      apiFetch<AdminPostListData>(`/api/admin/posts${toQueryString(params)}`, { accessToken }),
    enabled: status === "authenticated" && session?.user.role === "ADMIN" && Boolean(accessToken),
  });
}
