"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export interface StatusOption {
  value: string | undefined;
  label: string;
}

/** 기본값: 게시글 상태 (전체/발행/임시저장) */
const POST_STATUS_OPTIONS: StatusOption[] = [
  { value: undefined, label: "전체" },
  { value: "PUBLISHED", label: "발행" },
  { value: "DRAFT", label: "임시저장" },
];

interface PostFilterBarProps {
  basePath: string;
  q?: string;
  status?: string;
  placeholder?: string;
  /** 상태 버튼 노출 여부 — 댓글처럼 상태가 없는 목록은 false */
  showStatusFilter?: boolean;
  /** 상태 버튼 목록 — 회원(활성/정지)처럼 게시글이 아닌 목록에서 바꿔 쓴다 */
  statusOptions?: StatusOption[];
}

/** 검색어/상태 필터를 URL 쿼리(?q=&status=)로 관리한다 — 새로고침/뒤로가기에도 필터가 유지된다. */
export function PostFilterBar({
  basePath,
  q = "",
  status,
  placeholder = "제목 검색",
  showStatusFilter = true,
  statusOptions = POST_STATUS_OPTIONS,
}: PostFilterBarProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(q);

  function navigate(next: { q?: string; status?: string }) {
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

      {showStatusFilter && (
        <div className="flex items-center gap-1" role="group" aria-label="상태 필터">
          {statusOptions.map((option) => (
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
      )}
    </div>
  );
}
