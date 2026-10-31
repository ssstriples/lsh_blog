import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { renderPostContent } from "@/lib/renderPostContent";
import { Badge } from "@/components/ui/badge";
import { PostContent } from "@/components/post/PostContent";
import { PostToc } from "@/components/post/PostToc";
import { PostOwnerActions } from "@/components/post/PostOwnerActions";
import { CommentSection } from "@/components/comment/CommentSection";
import { LikeButton } from "@/components/post/LikeButton";
import { formatDate } from "@/lib/formatDate";
import type { PostDetail } from "@/types/post";

// ISR — 60초마다 재검증, 그 사이엔 캐시된 정적 페이지를 제공한다.
export const revalidate = 60;

async function getPost(slug: string): Promise<PostDetail | null> {
  try {
    return await apiFetch<PostDetail>(`/api/posts/${slug}`, { next: { revalidate } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function PostDetailPage(props: PageProps<"/posts/[slug]">) {
  const { slug } = await props.params;
  const post = await getPost(slug);
  if (!post) notFound();

  const { html, toc } = await renderPostContent(post.content);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <header className="flex flex-col gap-3 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Link href={`/users/${post.author.id}`} className="hover:text-foreground font-medium">
              {post.author.name}
            </Link>
            {post.publishedAt && (
              <>
                <span aria-hidden>·</span>
                <span>{formatDate(post.publishedAt)}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {post.viewCount}
            </span>
          </div>
          <PostOwnerActions postId={post.id} slug={post.slug} authorId={post.author.id} />
        </div>
      </header>

      <div className="flex gap-8 py-8">
        <PostToc items={toc} />
        <div className="min-w-0 flex-1">
          <PostContent html={html} />

          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-1.5">
              {post.tags.map(({ tag }) => (
                <Badge key={tag.id} variant="outline" render={<Link href={`/tag/${tag.slug}`} />}>
                  #{tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* 좋아요 수/여부도 사람마다 다르므로 ISR 본문과 분리해 클라이언트에서 조회 */}
          <div className="mt-8 flex justify-center">
            <LikeButton postId={post.id} />
          </div>

          {/* 본문은 ISR 캐시, 댓글은 클라이언트에서 실시간으로 불러온다 */}
          <CommentSection postId={post.id} postAuthorId={post.author.id} />
        </div>
      </div>
    </main>
  );
}
