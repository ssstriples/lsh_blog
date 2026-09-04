"use client";

import { useCategories } from "@/hooks/useCategories";
import { PostGrid } from "@/components/post/PostGrid";

export function CategoryPostList({ slug, page }: { slug: string; page: number }) {
  const { data: categories } = useCategories();
  const category = categories?.find((c) => c.slug === slug);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{category?.name ?? slug}</h1>
      <PostGrid page={page} basePath={`/category/${slug}`} category={slug} />
    </div>
  );
}
