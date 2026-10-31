"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/common/Pagination";
import { useSearch, type SearchResultPost } from "@/hooks/useSearch";
import { formatDate } from "@/lib/formatDate";

const PAGE_SIZE = 10;

/** 검색어와 일치하는 부분을 <mark>로 감싼다 — 문자열을 나눠 React 텍스트로 렌더링하므로 HTML 주입이 없다 */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const parts: { value: string; match: boolean }[] = [];
  let cursor = 0;

  for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, cursor)) {
    if (index > cursor) parts.push({ value: text.slice(cursor, index), match: false });
    parts.push({ value: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
  }
  if (cursor < text.length) parts.push({ value: text.slice(cursor), match: false });

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className="text-foreground rounded-sm bg-yellow-200 px-0.5 dark:bg-yellow-500/30"
          >
            {part.value}
          </mark>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

function SearchResultItem({ post, query }: { post: SearchResultPost; query: string }) {
  return (
    <li className="py-5">
      <Link href={`/posts/${post.slug}`} className="group flex flex-col gap-1.5">
        <h2 className="text-lg font-semibold group-hover:underline">
          <Highlight text={post.title} query={query} />
        </h2>
        <p className="text-muted-foreground line-clamp-2 text-sm">
          <Highlight text={post.excerpt} query={query} />
        </p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <span>{post.author.name}</span>
          {post.publishedAt && (
            <>
              <span aria-hidden>·</span>
              <span>{formatDate(post.publishedAt)}</span>
            </>
          )}
          {post.tags.map(({ tag }) => (
            <Badge key={tag.id} variant="outline">
              #{tag.name}
            </Badge>
          ))}
        </div>
      </Link>
    </li>
  );
}

export function SearchResults({ q, page }: { q: string; page: number }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(q);
  const { data, isFetching, isError } = useSearch({ q, page, limit: PAGE_SIZE });

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = keyword.trim();
          router.push(next ? `/search?q=${encodeURIComponent(next)}` : "/search");
        }}
      >
        <Input
          aria-label="검색어"
          placeholder="제목이나 본문으로 검색"
          maxLength={100}
          autoFocus={!q}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="h-10"
        />
        <Button type="submit" size="lg" className="h-10">
          <Search className="h-4 w-4" />
          검색
        </Button>
      </form>

      {!q ? (
        <p className="text-muted-foreground py-16 text-center text-sm">검색어를 입력해주세요.</p>
      ) : isError ? (
        <p className="text-destructive py-16 text-center text-sm">
          검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : !data ? (
        <p className="text-muted-foreground py-16 text-center text-sm">검색 중...</p>
      ) : (
        // 페이지를 넘기는 동안엔 이전 결과를 흐리게 유지한다 (레이아웃 점프 방지)
        <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
          <p className="text-muted-foreground text-sm">
            <strong className="text-foreground">&ldquo;{data.q}&rdquo;</strong> 검색 결과{" "}
            {data.pagination.totalCount}건
          </p>
          {data.posts.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              일치하는 게시글이 없습니다. 다른 검색어로 시도해보세요.
            </p>
          ) : (
            <>
              <ul className="divide-y">
                {data.posts.map((post) => (
                  <SearchResultItem key={post.id} post={post} query={data.q} />
                ))}
              </ul>
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                basePath="/search"
                query={{ q: data.q }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
