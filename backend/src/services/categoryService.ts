import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middlewares/errorHandler";
import { CreateCategoryInput, UpdateCategoryInput } from "@/schemas/categorySchema";

/**
 * 카테고리 이름으로부터 slug를 생성한다.
 * `slugify`의 strict 모드는 한글 등 비-라틴 문자를 전부 제거해버려서,
 * "개발"처럼 순수 한글 이름은 빈 문자열이 되어버리는 문제가 있었다.
 * 그래서 태그 slug 생성(postService.ts)과 동일하게 한글은 보존하는 방식으로 처리한다.
 */
function toSlug(value: string): string {
  const slugified = slugify(value, { lower: true, strict: true, trim: true });
  if (slugified) return slugified;

  // 한글 등 slugify가 전부 제거해버린 경우의 fallback
  const fallback = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-가-힣]/g, "");

  return fallback || "category";
}

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = toSlug(input.slug ?? input.name);

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    throw new AppError("이미 존재하는 슬러그입니다.", 409);
  }

  return prisma.category.create({
    data: { name: input.name, slug, sortOrder: input.sortOrder ?? 0 },
  });
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new AppError("존재하지 않는 카테고리입니다.", 404);
  }

  const nextSlugSource = input.slug ?? input.name;
  const slug = nextSlugSource ? toSlug(nextSlugSource) : undefined;

  if (slug && slug !== category.slug) {
    const conflict = await prisma.category.findUnique({ where: { slug } });
    if (conflict) {
      throw new AppError("이미 존재하는 슬러그입니다.", 409);
    }
  }

  return prisma.category.update({
    where: { id },
    data: { name: input.name, slug, sortOrder: input.sortOrder },
  });
}

export async function deleteCategory(id: string) {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) {
    throw new AppError("존재하지 않는 카테고리입니다.", 404);
  }

  const postCount = await prisma.post.count({ where: { categoryId: id } });
  if (postCount > 0) {
    throw new AppError("이 카테고리를 사용하는 게시글이 있어 삭제할 수 없습니다.", 409);
  }

  await prisma.category.delete({ where: { id } });
}

/** GET /api/tags — 전체 태그 목록 (게시글 수 많은 순, 공개) */
export async function listTags() {
  const tags = await prisma.tag.findMany({
    select: { id: true, name: true, slug: true, _count: { select: { posts: true } } },
  });

  return tags
    .map((t) => ({ id: t.id, name: t.name, slug: t.slug, postCount: t._count.posts }))
    .sort((a, b) => b.postCount - a.postCount);
}
