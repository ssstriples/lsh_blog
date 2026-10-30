"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/Pagination";
import { PostFilterBar } from "@/components/common/PostFilterBar";
import { useAdminComments, useAdminDeleteComment } from "@/hooks/useComments";
import { formatDateTime } from "@/lib/formatDate";
import type { AdminComment } from "@/types/comment";

const PAGE_SIZE = 20;

function AdminCommentRow({ comment }: { comment: AdminComment }) {
  const deleteMutation = useAdminDeleteComment();
  const authorName = comment.user?.name ?? comment.guestName ?? "익명";

  return (
    <tr className="border-b align-top last:border-0">
      <td className="max-w-0 py-3 pr-3">
        <p className="line-clamp-3 break-words whitespace-pre-wrap">{comment.content}</p>
        <Link
          href={`/posts/${comment.post.slug}`}
          className="text-muted-foreground mt-1 line-clamp-1 text-xs hover:underline"
        >
          {comment.parentId ? "↳ 답글 · " : ""}
          {comment.post.title}
        </Link>
      </td>
      <td className="max-w-0 py-3 pr-3">
        {comment.user ? (
          <>
            <Link href={`/users/${comment.user.id}`} className="line-clamp-1 hover:underline">
              {authorName}
            </Link>
            <span className="text-muted-foreground line-clamp-1 text-xs">{comment.user.email}</span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="line-clamp-1">{authorName}</span>
            <Badge variant="outline">비회원</Badge>
          </span>
        )}
      </td>
      <td className="text-muted-foreground hidden py-3 pr-3 text-xs sm:table-cell">
        {formatDateTime(comment.createdAt)}
      </td>
      <td className="py-3 text-right">
        <Button
          variant="destructive"
          size="sm"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (!window.confirm(`${authorName}님의 댓글을 강제 삭제하시겠습니까?`)) return;
            deleteMutation.mutate(
              { id: comment.id },
              {
                onSuccess: () => toast.success("관리자 권한으로 삭제되었습니다."),
                onError: (err) => toast.error(err.message),
              },
            );
          }}
        >
          <Trash2 className="h-4 w-4" />
          강제삭제
        </Button>
      </td>
    </tr>
  );
}

export function AdminCommentList({ page, q }: { page: number; q?: string }) {
  const { data, isPending, isError } = useAdminComments({ page, limit: PAGE_SIZE, q });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        전체 댓글{" "}
        {data && <span className="text-muted-foreground">({data.pagination.totalCount})</span>}
      </h1>

      <PostFilterBar
        basePath="/admin/comments"
        q={q}
        placeholder="내용 또는 작성자 검색"
        showStatusFilter={false}
      />

      {isPending ? (
        <p className="text-muted-foreground py-16 text-center text-sm">불러오는 중...</p>
      ) : isError ? (
        <p className="text-destructive py-16 text-center text-sm">
          댓글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : data.comments.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">댓글이 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] table-fixed text-sm">
              <thead className="text-muted-foreground border-b text-left">
                <tr>
                  <th className="py-2 pr-3 font-medium">내용 / 게시글</th>
                  <th className="w-40 py-2 pr-3 font-medium">작성자</th>
                  <th className="hidden w-40 py-2 pr-3 font-medium sm:table-cell">작성일</th>
                  <th className="w-28 py-2 text-right font-medium">모더레이션</th>
                </tr>
              </thead>
              <tbody>
                {data.comments.map((comment) => (
                  <AdminCommentRow key={comment.id} comment={comment} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            basePath="/admin/comments"
            query={{ q }}
          />
        </>
      )}
    </div>
  );
}
