"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/Pagination";
import { PostFilterBar } from "@/components/common/PostFilterBar";
import { PostStatusBadge } from "@/components/post/PostStatusBadge";
import { useMyPosts } from "@/hooks/useMyPosts";
import { useChangePostStatus, useDeletePost } from "@/hooks/usePostMutations";
import { formatDate } from "@/lib/formatDate";
import type { PostStatus, PostSummary } from "@/types/post";

const PAGE_SIZE = 20;

interface MyPostListProps {
  page: number;
  q?: string;
  status?: PostStatus;
}

function MyPostRow({ post }: { post: PostSummary }) {
  const statusMutation = useChangePostStatus();
  const deleteMutation = useDeletePost();
  const isBusy = statusMutation.isPending || deleteMutation.isPending;
  const nextStatus: PostStatus = post.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

  // 임시저장 글은 공개 상세 페이지(/posts/[slug])에서 조회되지 않으므로 수정 화면으로 연결한다.
  const titleHref = post.status === "PUBLISHED" ? `/posts/${post.slug}` : `/posts/${post.id}/edit`;

  return (
    <tr className="border-b last:border-0">
      <td className="max-w-0 py-3 pr-3">
        <Link href={titleHref} className="line-clamp-1 font-medium hover:underline">
          {post.title}
        </Link>
      </td>
      <td className="py-3 pr-3">
        <PostStatusBadge status={post.status} />
      </td>
      <td className="text-muted-foreground py-3 pr-3 text-right tabular-nums">
        {post.status === "PUBLISHED" ? post.viewCount : "-"}
      </td>
      <td className="text-muted-foreground hidden py-3 pr-3 sm:table-cell">
        {formatDate(post.createdAt)}
      </td>
      <td className="py-3">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() =>
              statusMutation.mutate(
                { id: post.id, status: nextStatus },
                {
                  onSuccess: () =>
                    toast.success(
                      nextStatus === "PUBLISHED" ? "발행되었습니다." : "비공개로 전환되었습니다.",
                    ),
                  onError: (err) => toast.error(err.message),
                },
              )
            }
          >
            {nextStatus === "PUBLISHED" ? "발행" : "비공개"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="수정"
            nativeButton={false}
            render={<Link href={`/posts/${post.id}/edit`} />}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="삭제"
            disabled={isBusy}
            onClick={() => {
              if (!window.confirm(`"${post.title}" 글을 삭제하시겠습니까?`)) return;
              deleteMutation.mutate(
                { id: post.id, slug: post.slug },
                {
                  onSuccess: () => toast.success("게시글이 삭제되었습니다."),
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function MyPostList({ page, q, status }: MyPostListProps) {
  const { data, isPending, isError } = useMyPosts({ page, limit: PAGE_SIZE, q, status });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          내가 쓴 글{" "}
          {data && <span className="text-muted-foreground">({data.pagination.totalCount})</span>}
        </h1>
        <Button nativeButton={false} render={<Link href="/posts/new" />}>
          <Plus className="h-4 w-4" />새 글 작성
        </Button>
      </div>

      <PostFilterBar basePath="/my/posts" q={q} status={status} />

      {isPending ? (
        <p className="text-muted-foreground py-16 text-center text-sm">불러오는 중...</p>
      ) : isError ? (
        <p className="text-destructive py-16 text-center text-sm">
          게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : data.posts.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {q || status ? "조건에 맞는 글이 없습니다." : "아직 작성한 글이 없습니다."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="text-muted-foreground border-b text-left">
                <tr>
                  <th className="py-2 pr-3 font-medium">제목</th>
                  <th className="w-24 py-2 pr-3 font-medium">상태</th>
                  <th className="w-16 py-2 pr-3 text-right font-medium">조회수</th>
                  <th className="hidden w-36 py-2 pr-3 font-medium sm:table-cell">작성일</th>
                  <th className="w-36 py-2 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {data.posts.map((post) => (
                  <MyPostRow key={post.id} post={post} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            basePath="/my/posts"
            query={{ q, status }}
          />
        </>
      )}
    </div>
  );
}
