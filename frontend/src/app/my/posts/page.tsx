import { MyPostList } from "@/components/post/MyPostList";
import { parseStatusParam } from "@/lib/parseStatusParam";

// 🔒 로그인 필요 — proxy.ts가 /my/* 비로그인 접근을 /login으로 리다이렉트한다.
export default async function MyPostsPage(props: PageProps<"/my/posts">) {
  const { page: pageParam, q, status } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <MyPostList
        page={page}
        q={typeof q === "string" ? q : undefined}
        status={parseStatusParam(status)}
      />
    </main>
  );
}
