import type { PostStatus } from "@/types/post";

/** URL 쿼리의 status 값을 검증한다 — 허용된 값이 아니면 필터 없음(undefined)으로 취급. */
export function parseStatusParam(value: string | string[] | undefined): PostStatus | undefined {
  return value === "DRAFT" || value === "PUBLISHED" ? value : undefined;
}
