"use client";

import { CommentItem } from "@/components/comment/CommentItem";
import type { CommentNode } from "@/types/comment";

interface CommentListProps {
  comments: CommentNode[];
  postId: string;
  postAuthorId: string;
}

export function CommentList({ comments, postId, postAuthorId }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">첫 댓글을 남겨보세요.</p>;
  }

  return (
    <ul className="divide-y">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          postId={postId}
          postAuthorId={postAuthorId}
        />
      ))}
    </ul>
  );
}
