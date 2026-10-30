"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateComment } from "@/hooks/useComments";

/** 백엔드 createCommentSchema와 동일한 제한 */
const MAX_LENGTH = 1000;

interface CommentFormProps {
  postId: string;
  /** 답글이면 부모 댓글 id */
  parentId?: string;
  onDone?: () => void;
  onCancel?: () => void;
}

/** 로그인 상태면 내용만, 비로그인이면 닉네임 + 삭제용 비밀번호 + 내용을 받는다. */
export function CommentForm({ postId, parentId, onDone, onCancel }: CommentFormProps) {
  const pathname = usePathname();
  const { status } = useSession();
  const createMutation = useCreateComment(postId);

  const [content, setContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPassword, setGuestPassword] = useState("");

  // 세션 확인 중("loading")에는 게스트 입력칸을 띄우지 않는다 — 로그인 유저에게 잠깐 깜빡이지 않도록
  const isGuest = status === "unauthenticated";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("댓글 내용을 입력해주세요.");
      return;
    }
    if (isGuest && (guestName.trim().length < 2 || guestPassword.length < 4)) {
      toast.error("닉네임(2자 이상)과 비밀번호(4자 이상)를 입력해주세요.");
      return;
    }

    createMutation.mutate(
      {
        content: content.trim(),
        parentId,
        ...(isGuest ? { guestName: guestName.trim(), guestPassword } : {}),
      },
      {
        onSuccess: () => {
          setContent("");
          setGuestPassword("");
          onDone?.();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {isGuest && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="닉네임"
            placeholder="닉네임"
            maxLength={20}
            autoComplete="nickname"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="sm:max-w-40"
          />
          <Input
            aria-label="삭제용 비밀번호"
            type="password"
            placeholder="삭제용 비밀번호"
            maxLength={20}
            autoComplete="new-password"
            value={guestPassword}
            onChange={(e) => setGuestPassword(e.target.value)}
            className="sm:max-w-40"
          />
        </div>
      )}

      <textarea
        aria-label={parentId ? "답글 내용" : "댓글 내용"}
        placeholder={parentId ? "답글을 입력하세요" : "댓글을 입력하세요"}
        maxLength={MAX_LENGTH}
        rows={parentId ? 2 : 3}
        autoFocus={Boolean(parentId)}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 w-full resize-y rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {isGuest ? (
            <>
              비회원으로 작성합니다.{" "}
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                className="underline underline-offset-4"
              >
                로그인
              </Link>
              하면 닉네임 없이 작성할 수 있어요.
            </>
          ) : (
            `${content.length} / ${MAX_LENGTH}`
          )}
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              취소
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={createMutation.isPending || status === "loading"}
          >
            {createMutation.isPending ? "등록 중..." : parentId ? "답글 등록" : "댓글 등록"}
          </Button>
        </div>
      </div>
    </form>
  );
}
