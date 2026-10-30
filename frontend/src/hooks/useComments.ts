import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { toQueryString } from "@/lib/queryString";
import type {
  AdminCommentListData,
  CommentListData,
  CommentNode,
  CreateCommentInput,
} from "@/types/comment";

/** GET /api/posts/:postId/comments — 대댓글 포함 트리 (CSR, 게시글 본문은 ISR이라 댓글만 따로 가져온다) */
export function useComments(postId: string) {
  return useQuery({
    queryKey: ["comments", postId],
    queryFn: () => apiFetch<CommentListData>(`/api/posts/${postId}/comments`),
  });
}

function useInvalidateComments() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["comments"] }),
      queryClient.invalidateQueries({ queryKey: ["adminComments"] }),
    ]);
}

/** POST /api/posts/:postId/comments — 로그인 상태면 토큰을 실어 회원 댓글로, 아니면 게스트 댓글로 */
export function useCreateComment(postId: string) {
  const { data: session } = useSession();
  const invalidate = useInvalidateComments();

  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      apiFetch<CommentNode>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify(input),
        accessToken: session?.accessToken,
      }),
    onSuccess: () => invalidate(),
  });
}

/**
 * 댓글 삭제
 * - `password` 없음: DELETE /api/comments/:id (🔑 본인 댓글, ADMIN은 게스트 댓글 포함 전부)
 * - `password` 있음: POST /api/comments/:id/guest-delete (게스트 댓글 비밀번호 확인)
 */
export function useDeleteComment() {
  const { data: session } = useSession();
  const invalidate = useInvalidateComments();

  return useMutation({
    mutationFn: ({ id, password }: { id: string; password?: string }) =>
      password !== undefined
        ? apiFetch(`/api/comments/${id}/guest-delete`, {
            method: "POST",
            body: JSON.stringify({ password }),
          })
        : apiFetch(`/api/comments/${id}`, { method: "DELETE", accessToken: session?.accessToken }),
    onSuccess: () => invalidate(),
  });
}

/** GET /api/admin/comments — 🛡️ 전체 댓글 (q = 내용/작성자명) */
export function useAdminComments(params: { page?: number; limit?: number; q?: string } = {}) {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  return useQuery({
    queryKey: ["adminComments", params],
    queryFn: () =>
      apiFetch<AdminCommentListData>(`/api/admin/comments${toQueryString(params)}`, {
        accessToken,
      }),
    enabled: status === "authenticated" && session?.user.role === "ADMIN" && Boolean(accessToken),
  });
}

/** DELETE /api/admin/comments/:id — 🛡️ 관리자 강제 삭제 */
export function useAdminDeleteComment() {
  const { data: session } = useSession();
  const invalidate = useInvalidateComments();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch(`/api/admin/comments/${id}`, {
        method: "DELETE",
        accessToken: session?.accessToken,
      }),
    onSuccess: () => invalidate(),
  });
}
