"use client";

import { CommentForm } from "@/components/comment/CommentForm";
import { CommentList } from "@/components/comment/CommentList";
import { useComments } from "@/hooks/useComments";

/**
 * 게시글 상세 하단 댓글 영역.
 * 상세 페이지 본문은 ISR(60초 캐시)이지만 댓글은 바로바로 보여야 하므로 클라이언트에서 따로 불러온다.
 */
export function CommentSection({ postId, postAuthorId }: { postId: string; postAuthorId: string }) {
  const { data, isPending, isError } = useComments(postId);

  return (
    <section aria-labelledby="comments-heading" className="mt-12 flex flex-col gap-4 border-t pt-8">
      <h2 id="comments-heading" className="text-lg font-semibold">
        댓글 {data && <span className="text-muted-foreground">{data.totalCount}</span>}
      </h2>

      <CommentForm postId={postId} />

      {isPending ? (
        <p className="text-muted-foreground py-8 text-center text-sm">댓글을 불러오는 중...</p>
      ) : isError ? (
        <p className="text-destructive py-8 text-center text-sm">댓글을 불러오지 못했습니다.</p>
      ) : (
        <CommentList comments={data.comments} postId={postId} postAuthorId={postAuthorId} />
      )}
    </section>
  );
}
