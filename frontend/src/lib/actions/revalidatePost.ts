"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";

const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;

/**
 * 게시글 저장/상태 변경/삭제 후 ISR로 캐시된 상세 페이지(`/posts/[slug]`)를 즉시 무효화한다.
 * Server Action은 누구나 호출할 수 있는 공개 엔드포인트이므로 로그인 여부와 slug 형식을 검증한다.
 */
export async function revalidatePostPages(slugs: string[]): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  for (const slug of new Set(slugs)) {
    if (SLUG_PATTERN.test(slug)) revalidatePath(`/posts/${slug}`);
  }
}
