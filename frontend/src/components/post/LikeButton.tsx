"use client";

import { Heart } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLike, useToggleLike } from "@/hooks/useLike";

/** 게시글 상세의 좋아요 버튼 — 로그인 없이도 누를 수 있다 (게스트는 쿠키 기준 1회) */
export function LikeButton({ postId }: { postId: string }) {
  const { data } = useLike(postId);
  const toggleMutation = useToggleLike(postId);

  const liked = data?.liked ?? false;
  const likeCount = data?.likeCount ?? 0;

  return (
    <Button
      variant="outline"
      aria-pressed={liked}
      aria-label={liked ? `좋아요 취소 (현재 ${likeCount}개)` : `좋아요 (현재 ${likeCount}개)`}
      disabled={!data || toggleMutation.isPending}
      onClick={() =>
        toggleMutation.mutate(undefined, { onError: (err) => toast.error(err.message) })
      }
      className="gap-1.5 rounded-full px-4"
    >
      <Heart
        className={cn("h-4 w-4 transition-colors", liked && "fill-red-500 text-red-500")}
        aria-hidden
      />
      <span>{likeCount}</span>
    </Button>
  );
}
