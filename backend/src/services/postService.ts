import DOMPurify from "isomorphic-dompurify";
import { Prisma, PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middlewares/errorHandler";
import { generateUniqueSlug } from "@/lib/slug";
import { hashIp } from "@/lib/ip";
import type { CreatePostInput, UpdatePostInput, ListPostsQuery } from "@/schemas/postSchema";

const POST_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  thumbnailUrl: true,
  status: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} satisfies Prisma.PostSelect;

/** 게시글 본문(HTML)의 XSS 위험 요소를 제거한다. */
function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    // 코드 하이라이팅(Shiki), TipTap이 생성하는 마크업을 허용하기 위한 확장 태그/속성
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "rel", "class", "data-language"],
  });
}

/** 태그 이름 배열을 받아 존재하지 않으면 생성(upsert)하고 PostTag 연결용 데이터를 반환한다. */
async function upsertTags(tagNames: string[]) {
  const uniqueNames = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))];

  const tags = await Promise.all(
    uniqueNames.map((name) =>
      prisma.tag.upsert({
        where: { name },
        update: {},
        create: {
          name,
          slug: name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-가-힣]/g, ""),
        },
      }),
    ),
  );

  return tags;
}

export async function createPost(authorId: string, input: CreatePostInput) {
  const slug = input.slug ?? (await generateUniqueSlug(input.title));

  if (input.slug) {
    const existing = await prisma.post.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw new AppError("이미 사용 중인 슬러그입니다.", 409);
    }
  }

  const tags = input.tags ? await upsertTags(input.tags) : [];
  const status = input.status ?? "DRAFT";

  const post = await prisma.post.create({
    data: {
      title: input.title,
      slug,
      content: sanitizeContent(input.content),
      thumbnailUrl: input.thumbnailUrl ?? null,
      categoryId: input.categoryId ?? null,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      authorId, // ⚠️ 요청 바디가 아닌, 인증된 사용자 ID로 서버에서 강제 설정
      tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
    },
    select: POST_LIST_SELECT,
  });

  return post;
}

/** 리소스 소유권 검증에서 사용 — 게시글의 authorId만 가볍게 조회 */
export async function getPostAuthorId(postId: string): Promise<string | null> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  return post?.authorId ?? null;
}

export async function updatePost(postId: string, input: UpdatePostInput) {
  const data: Prisma.PostUpdateInput = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.content !== undefined) data.content = sanitizeContent(input.content);
  if (input.thumbnailUrl !== undefined) data.thumbnailUrl = input.thumbnailUrl;
  if (input.categoryId !== undefined) {
    data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
  }

  if (input.slug !== undefined) {
    const existing = await prisma.post.findFirst({
      where: { slug: input.slug, NOT: { id: postId } },
    });
    if (existing) throw new AppError("이미 사용 중인 슬러그입니다.", 409);
    data.slug = input.slug;
  }

  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "PUBLISHED") {
      const current = await prisma.post.findUnique({ where: { id: postId }, select: { publishedAt: true } });
      if (!current?.publishedAt) data.publishedAt = new Date();
    }
  }

  if (input.tags !== undefined) {
    const tags = await upsertTags(input.tags);
    data.tags = {
      deleteMany: {},
      create: tags.map((tag) => ({ tagId: tag.id })),
    };
  }

  const post = await prisma.post.update({
    where: { id: postId },
    data,
    select: POST_LIST_SELECT,
  });

  return post;
}

export async function updatePostStatus(postId: string, status: PostStatus) {
  const current = await prisma.post.findUnique({ where: { id: postId }, select: { publishedAt: true } });

  const post = await prisma.post.update({
    where: { id: postId },
    data: {
      status,
      publishedAt: status === "PUBLISHED" && !current?.publishedAt ? new Date() : undefined,
    },
    select: POST_LIST_SELECT,
  });

  return post;
}

/** 소프트 삭제 — 실제로 레코드를 지우지 않고 deletedAt만 채운다. */
export async function softDeletePost(postId: string) {
  await prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
}

export async function listPosts(query: ListPostsQuery) {
  const { page, limit, category, tag, q, sort, authorId } = query;

  const where: Prisma.PostWhereInput = {
    deletedAt: null,
    status: "PUBLISHED",
    ...(category ? { category: { slug: category } } : {}),
    ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
    ...(authorId ? { authorId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { content: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.PostOrderByWithRelationInput =
    sort === "popular" ? { viewCount: "desc" } : { publishedAt: "desc" };

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: POST_LIST_SELECT,
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
  };
}

/** 마이페이지 — 본인 글 전체 (DRAFT 포함) */
export async function listMyPosts(authorId: string, query: ListPostsQuery) {
  const { page, limit } = query;

  const where: Prisma.PostWhereInput = { authorId, deletedAt: null };

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: POST_LIST_SELECT,
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
  };
}

/** 특정 작성자의 공개 글만 (다른 유저가 볼 수 있는 프로필 페이지용) */
export async function listPostsByAuthor(authorId: string, query: ListPostsQuery) {
  return listPosts({ ...query, authorId });
}

export async function getPostBySlug(slug: string, clientIp: string) {
  const post = await prisma.post.findFirst({
    where: { slug, deletedAt: null, status: "PUBLISHED" },
    select: {
      ...POST_LIST_SELECT,
      content: true,
    },
  });

  if (!post) {
    throw new AppError("게시글을 찾을 수 없습니다.", 404);
  }

  // 조회수 증가 — 동일 IP는 하루 동안 중복 카운트되지 않도록 PostView 유니크 제약 활용
  const ipHash = hashIp(clientIp);
  try {
    await prisma.postView.create({ data: { postId: post.id, ipHash } });
    await prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });
  } catch {
    // 유니크 제약 위반(이미 조회한 IP) — 조용히 무시하고 조회수는 그대로 유지
  }

  return post;
}

/** 소유권 검증 없이 id로 게시글 상세를 가져올 때 사용 (수정 화면 진입 시 등) */
export async function getPostById(postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { ...POST_LIST_SELECT, content: true },
  });

  if (!post) {
    throw new AppError("게시글을 찾을 수 없습니다.", 404);
  }

  return post;
}
