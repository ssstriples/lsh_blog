"use client";

import { usePosts } from "@/hooks/usePosts";
import { PostCard } from "@/components/post/PostCard";
import { Pagination } from "@/components/common/Pagination";
import type { ListPostsParams } from "@/types/post";

const PAGE_SIZE = 12;

interface PostGridProps extends Omit<ListPostsParams, "page" | "limit"> {
  page: number;
  /** 페이지네이션 링크 basePath (예: "/", "/category/tech") */
  basePath: string;
}

export function PostGrid({ page, basePath, ...filters }: PostGridProps) {
  const { data, isPending, isError } = usePosts({ ...filters, page, limit: PAGE_SIZE });

  if (isPending) {
    return <p className="py-16 text-center text-sm text-muted-foreground">불러오는 중...</p>;
  }

  if (isError) {
    return (
      <p className="py-16 text-center text-sm text-destructive">
        게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  if (data.posts.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">아직 게시글이 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} basePath={basePath} />
    </div>
  );
}
