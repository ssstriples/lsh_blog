import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

export interface LikeStatus {
  liked: boolean;
  likeCount: number;
}

/**
 * 게스트 좋아요는 백엔드가 심는 HttpOnly `guestId` 쿠키로 식별한다.
 * 프론트(:3000) → 백엔드(:4100)는 cross-origin fetch라 `credentials: "include"`가 있어야 쿠키가 오간다.
 */
const WITH_COOKIES = { credentials: "include" } as const;

/** GET /api/posts/:postId/like — 내 좋아요 여부 + 전체 수 (로그인 상태가 바뀌면 다시 조회) */
export function useLike(postId: string) {
  const { data: session, status } = useSession();
  const viewerKey = session?.user.id ?? "guest";

  return useQuery({
    queryKey: ["like", postId, viewerKey],
    queryFn: () =>
      apiFetch<LikeStatus>(`/api/posts/${postId}/like`, {
        ...WITH_COOKIES,
        accessToken: session?.accessToken,
      }),
    enabled: status !== "loading",
  });
}

/** POST /api/posts/:postId/like — 낙관적 업데이트: 누르는 즉시 화면을 바꾸고, 실패하면 되돌린다 */
export function useToggleLike(postId: string) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ["like", postId, session?.user.id ?? "guest"];

  return useMutation({
    mutationFn: () =>
      apiFetch<LikeStatus>(`/api/posts/${postId}/like`, {
        method: "POST",
        ...WITH_COOKIES,
        accessToken: session?.accessToken,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LikeStatus>(queryKey);
      if (previous) {
        queryClient.setQueryData<LikeStatus>(queryKey, {
          liked: !previous.liked,
          likeCount: previous.likeCount + (previous.liked ? -1 : 1),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    // 서버가 돌려준 실제 값으로 맞춘다 (다른 사람이 동시에 누른 수까지 반영)
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });
}
