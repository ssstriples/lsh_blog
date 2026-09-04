"use client";

import { useTags } from "@/hooks/useTags";
import { PostGrid } from "@/components/post/PostGrid";

export function TagPostList({ slug, page }: { slug: string; page: number }) {
  const { data: tags } = useTags();
  const tag = tags?.find((t) => t.slug === slug);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">#{tag?.name ?? slug}</h1>
      <PostGrid page={page} basePath={`/tag/${slug}`} tag={slug} />
    </div>
  );
}
