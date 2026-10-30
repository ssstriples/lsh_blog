"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { MessageSquareReply, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatDate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommentForm } from "@/components/comment/CommentForm";
import { useDeleteComment } from "@/hooks/useComments";
import type { CommentNode } from "@/types/comment";

/** 이 깊이부터는 더 들여쓰지 않는다 (좁은 화면에서 본문이 너무 좁아지지 않도록) */
const MAX_INDENT_DEPTH = 3;

interface CommentItemProps {
  comment: CommentNode;
  postId: string;
  postAuthorId: string;
  depth?: number;
}

export function CommentItem({ comment, postId, postAuthorId, depth = 0 }: CommentItemProps) {
  const { data: session } = useSession();
  const deleteMutation = useDeleteComment();
  const [isReplying, setIsReplying] = useState(false);
  const [isAskingPassword, setIsAskingPassword] = useState(false);
  const [password, setPassword] = useState("");

  const viewer = session?.user;
  const author = comment.author;
  const isAdmin = viewer?.role === "ADMIN";

  // 삭제 버튼 노출 규칙 (최종 권한 판단은 백엔드):
  // - 회원 댓글: 작성자 본인 또는 ADMIN → DELETE /api/comments/:id
  // - 게스트 댓글: ADMIN은 바로 삭제, 그 외엔 작성 시 비밀번호로 삭제
  const canDeleteAsMember =
    author !== null && (isAdmin || (author.type === "user" && author.id === viewer?.id));
  const canDeleteAsGuest = author?.type === "guest" && !isAdmin;

  function deleteComment(guestPassword?: string) {
    deleteMutation.mutate(
      { id: comment.id, password: guestPassword },
      {
        onSuccess: () => {
          toast.success("댓글이 삭제되었습니다.");
          setIsAskingPassword(false);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <li className={cn(depth > 0 && depth <= MAX_INDENT_DEPTH && "ml-4 border-l pl-4 sm:ml-6")}>
      <article className="flex flex-col gap-1.5 py-3">
        {comment.isDeleted || !author ? (
          <p className="text-muted-foreground text-sm italic">삭제된 댓글입니다.</p>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-2 text-sm">
              {author.type === "user" ? (
                <Link href={`/users/${author.id}`} className="font-medium hover:underline">
                  {author.name}
                </Link>
              ) : (
                <span className="font-medium">{author.name}</span>
              )}
              {author.type === "guest" && <Badge variant="outline">비회원</Badge>}
              {author.type === "user" && author.id === postAuthorId && <Badge>작성자</Badge>}
              <time dateTime={comment.createdAt} className="text-muted-foreground text-xs">
                {formatDateTime(comment.createdAt)}
              </time>
            </header>

            {/* 댓글은 평문 — React가 이스케이프해서 렌더링하므로 HTML로 해석되지 않는다 */}
            <p className="text-sm break-words whitespace-pre-wrap">{comment.content}</p>

            <div className="flex flex-wrap items-center gap-1">
              <Button variant="ghost" size="xs" onClick={() => setIsReplying((v) => !v)}>
                <MessageSquareReply />
                답글
              </Button>
              {canDeleteAsMember && (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm("이 댓글을 삭제하시겠습니까?")) deleteComment();
                  }}
                >
                  <Trash2 />
                  삭제
                </Button>
              )}
              {canDeleteAsGuest && !isAskingPassword && (
                <Button variant="ghost" size="xs" onClick={() => setIsAskingPassword(true)}>
                  <Trash2 />
                  삭제
                </Button>
              )}
            </div>

            {isAskingPassword && (
              <form
                className="flex max-w-xs items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (password) deleteComment(password);
                }}
              >
                <Input
                  type="password"
                  aria-label="댓글 비밀번호"
                  placeholder="작성 시 입력한 비밀번호"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                >
                  삭제
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAskingPassword(false);
                    setPassword("");
                  }}
                >
                  취소
                </Button>
              </form>
            )}
          </>
        )}

        {isReplying && !comment.isDeleted && (
          <div className="mt-1">
            <CommentForm
              postId={postId}
              parentId={comment.id}
              onDone={() => setIsReplying(false)}
              onCancel={() => setIsReplying(false)}
            />
          </div>
        )}
      </article>

      {comment.replies.length > 0 && (
        <ul>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              postId={postId}
              postAuthorId={postAuthorId}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
