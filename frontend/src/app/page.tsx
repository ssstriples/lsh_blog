import { PostGrid } from "@/components/post/PostGrid";

export default async function Home(props: PageProps<"/">) {
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b bg-muted/30 py-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">lsh_blog</h1>
        <p className="mt-2 text-muted-foreground">개발하면서 배운 것들을 기록합니다.</p>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <PostGrid page={page} basePath="/" />
      </main>
    </div>
  );
}
