import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { revalidatePostPages } from "@/lib/actions/revalidatePost";
import type { PostInput, PostStatus, PostSummary } from "@/types/post";

/** 게시글이 바뀌면 목록 캐시(TanStack Query)와 상세 페이지 캐시(ISR)를 함께 무효화한다. */
function useInvalidatePosts() {
  const queryClient = useQueryClient();

  return async (slugs: string[]) => {
    await revalidatePostPages(slugs);
    await Promise.all(
      ["posts", "post", "myPosts", "adminPosts", "tags"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
}

interface SavePostVariables {
  /** 없으면 새 글 생성(POST), 있으면 수정(PATCH) */
  id?: string;
  input: PostInput;
  /** 수정 전 slug — slug가 바뀌었다면 이전 주소의 ISR 캐시도 지워야 한다 */
  previousSlug?: string;
}

/** POST /api/posts, PATCH /api/posts/:id */
export function useSavePost() {
  const { data: session } = useSession();
  const invalidate = useInvalidatePosts();

  return useMutation({
    mutationFn: ({ id, input }: SavePostVariables) =>
      apiFetch<PostSummary>(id ? `/api/posts/${id}` : "/api/posts", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(input),
        accessToken: session?.accessToken,
      }),
    onSuccess: (post, { previousSlug }) =>
      invalidate(previousSlug ? [post.slug, previousSlug] : [post.slug]),
  });
}

/** PATCH /api/posts/:id/status — 본인 글(또는 ADMIN)의 발행/비공개 전환 */
export function useChangePostStatus() {
  const { data: session } = useSession();
  const invalidate = useInvalidatePosts();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PostStatus }) =>
      apiFetch<PostSummary>(`/api/posts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        accessToken: session?.accessToken,
      }),
    onSuccess: (post) => invalidate([post.slug]),
  });
}

/**
 * 게시글 소프트 삭제
 * - 기본: DELETE /api/posts/:id (🔑 소유권 검증)
 * - `asAdmin`: DELETE /api/admin/posts/:id (🛡️ 관리자 강제 삭제, 소유권 무관)
 */
export function useDeletePost({ asAdmin = false }: { asAdmin?: boolean } = {}) {
  const { data: session } = useSession();
  const invalidate = useInvalidatePosts();

  return useMutation({
    mutationFn: ({ id }: { id: string; slug: string }) =>
      apiFetch(asAdmin ? `/api/admin/posts/${id}` : `/api/posts/${id}`, {
        method: "DELETE",
        accessToken: session?.accessToken,
      }),
    onSuccess: (_data, { slug }) => invalidate([slug]),
  });
}
