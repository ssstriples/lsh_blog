import { AdminPostList } from "@/components/admin/AdminPostList";
import { parseStatusParam } from "@/lib/parseStatusParam";

// 🛡️ 관리자 전용 — proxy.ts가 비관리자 접근을 /403으로 리다이렉트한다 (최종 권한 검증은 백엔드 requireAdmin).
export default async function AdminPostsPage(props: PageProps<"/admin/posts">) {
  const { page: pageParam, q, status } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <AdminPostList
        page={page}
        q={typeof q === "string" ? q : undefined}
        status={parseStatusParam(status)}
      />
    </main>
  );
}
