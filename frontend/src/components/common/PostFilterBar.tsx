"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PostStatus } from "@/types/post";

const STATUS_OPTIONS: { value: PostStatus | undefined; label: string }[] = [
  { value: undefined, label: "전체" },
  { value: "PUBLISHED", label: "발행" },
  { value: "DRAFT", label: "임시저장" },
];

interface PostFilterBarProps {
  basePath: string;
  q?: string;
  status?: PostStatus;
  placeholder?: string;
}

/** 검색어/상태 필터를 URL 쿼리(?q=&status=)로 관리한다 — 새로고침/뒤로가기에도 필터가 유지된다. */
export function PostFilterBar({
  basePath,
  q = "",
  status,
  placeholder = "제목 검색",
}: PostFilterBarProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(q);

  function navigate(next: { q?: string; status?: PostStatus }) {
    const search = new URLSearchParams();
    if (next.q) search.set("q", next.q);
    if (next.status) search.set("status", next.status);
    const query = search.toString();
    router.push(query ? `${basePath}?${query}` : basePath); // 필터가 바뀌면 1페이지부터
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form
        className="flex w-full max-w-xs items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: keyword.trim(), status });
        }}
      >
        <Input
          aria-label="검색어"
          placeholder={placeholder}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Button type="submit" variant="outline" size="icon" aria-label="검색">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <div className="flex items-center gap-1" role="group" aria-label="상태 필터">
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.label}
            size="sm"
            variant={option.value === status ? "default" : "outline"}
            className={cn(option.value === status && "pointer-events-none")}
            onClick={() => navigate({ q, status: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
