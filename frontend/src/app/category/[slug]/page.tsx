import { CategoryPostList } from "@/components/post/CategoryPostList";

export default async function CategoryPage(props: PageProps<"/category/[slug]">) {
  const { slug } = await props.params;
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <CategoryPostList slug={slug} page={page} />
    </main>
  );
}
