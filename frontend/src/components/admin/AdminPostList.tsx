"use client";

import Link from "next/link";
import { toast } from "sonner";
import { EyeOff, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/Pagination";
import { PostFilterBar } from "@/components/common/PostFilterBar";
import { PostStatusBadge } from "@/components/post/PostStatusBadge";
import { useAdminPosts } from "@/hooks/useAdminPosts";
import { useChangePostStatus, useDeletePost } from "@/hooks/usePostMutations";
import { formatDate } from "@/lib/formatDate";
import type { AdminPostSummary, PostStatus } from "@/types/post";

const PAGE_SIZE = 20;

function AdminPostRow({ post }: { post: AdminPostSummary }) {
  // 비공개 전환은 PATCH /api/posts/:id/status 재사용 (소유권 검증에서 ADMIN은 예외 통과)
  const statusMutation = useChangePostStatus();
  const deleteMutation = useDeletePost({ asAdmin: true });
  const isBusy = statusMutation.isPending || deleteMutation.isPending;

  return (
    <tr className="border-b last:border-0">
      <td className="max-w-0 py-3 pr-3">
        {post.status === "PUBLISHED" ? (
          <Link href={`/posts/${post.slug}`} className="line-clamp-1 font-medium hover:underline">
            {post.title}
          </Link>
        ) : (
          <span className="line-clamp-1 font-medium">{post.title}</span>
        )}
        <span className="text-muted-foreground text-xs">{formatDate(post.createdAt)}</span>
      </td>
      <td className="max-w-0 py-3 pr-3">
        <Link href={`/users/${post.author.id}`} className="line-clamp-1 hover:underline">
          {post.author.name}
        </Link>
        <span className="text-muted-foreground line-clamp-1 text-xs">{post.author.email}</span>
      </td>
      <td className="py-3 pr-3">
        <PostStatusBadge status={post.status} />
      </td>
      <td className="text-muted-foreground py-3 pr-3 text-right tabular-nums">{post.viewCount}</td>
      <td className="py-3">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={isBusy || post.status === "DRAFT"}
            onClick={() => {
              if (!window.confirm(`"${post.title}" 글을 비공개로 전환하시겠습니까?`)) return;
              statusMutation.mutate(
                { id: post.id, status: "DRAFT" },
                {
                  onSuccess: () => toast.success("비공개로 전환되었습니다."),
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            <EyeOff className="h-4 w-4" />
            비공개
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              if (
                !window.confirm(
                  `"${post.title}" 글을 강제 삭제하시겠습니까? (작성자: ${post.author.name})`,
                )
              ) {
                return;
              }
              deleteMutation.mutate(
                { id: post.id, slug: post.slug },
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
        </div>
      </td>
    </tr>
  );
}

export function AdminPostList({
  page,
  q,
  status,
}: {
  page: number;
  q?: string;
  status?: PostStatus;
}) {
  const { data, isPending, isError } = useAdminPosts({ page, limit: PAGE_SIZE, q, status });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        전체 게시글{" "}
        {data && <span className="text-muted-foreground">({data.pagination.totalCount})</span>}
      </h1>

      <PostFilterBar
        basePath="/admin/posts"
        q={q}
        status={status}
        placeholder="제목 또는 작성자 검색"
      />

      {isPending ? (
        <p className="text-muted-foreground py-16 text-center text-sm">불러오는 중...</p>
      ) : isError ? (
        <p className="text-destructive py-16 text-center text-sm">
          게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : data.posts.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">게시글이 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <thead className="text-muted-foreground border-b text-left">
                <tr>
                  <th className="py-2 pr-3 font-medium">제목</th>
                  <th className="w-40 py-2 pr-3 font-medium">작성자</th>
                  <th className="w-24 py-2 pr-3 font-medium">상태</th>
                  <th className="w-16 py-2 pr-3 text-right font-medium">조회수</th>
                  <th className="w-48 py-2 text-right font-medium">모더레이션</th>
                </tr>
              </thead>
              <tbody>
                {data.posts.map((post) => (
                  <AdminPostRow key={post.id} post={post} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            basePath="/admin/posts"
            query={{ q, status }}
          />
        </>
      )}
    </div>
  );
}
