import { SearchResults } from "@/components/search/SearchResults";

export default async function SearchPage(props: PageProps<"/search">) {
  const { q, page: pageParam } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">검색</h1>
      {/* key: 헤더 등에서 다른 검색어로 이동하면 입력창 상태도 새 검색어로 초기화 */}
      <SearchResults key={query} q={query} page={page} />
    </main>
  );
}
