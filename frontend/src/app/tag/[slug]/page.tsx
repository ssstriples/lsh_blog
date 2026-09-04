import { TagPostList } from "@/components/post/TagPostList";

export default async function TagPage(props: PageProps<"/tag/[slug]">) {
  const { slug } = await props.params;
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <TagPostList slug={slug} page={page} />
    </main>
  );
}
