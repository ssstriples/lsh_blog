import slugify from "slugify";
import { prisma } from "@/lib/prisma";

/**
 * 제목으로부터 URL-safe slug를 생성한다.
 * 이미 존재하는 slug와 충돌하면 뒤에 랜덤 접미사를 붙여 유니크하게 만든다.
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, trim: true }) || "post";

  let candidate = base;
  let suffix = 0;

  // 최대 20번까지 충돌 확인 (사실상 거의 1~2번 안에 끝남)
  while (suffix < 20) {
    const existing = await prisma.post.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;

    suffix += 1;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // 극단적인 경우를 대비한 fallback
  return `${base}-${Date.now()}`;
}
