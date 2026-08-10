import { z } from "zod";

/**
 * 게시글 생성 입력 검증
 * - authorId는 여기 포함하지 않는다 — 컨트롤러에서 req.user.id로 서버가 강제 설정한다.
 */
export const createPostSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(200, "제목은 200자 이내여야 합니다."),
  content: z.string().min(1, "본문을 입력해주세요."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.")
    .optional(), // 없으면 title로 자동 생성
  thumbnailUrl: z.string().url("올바른 이미지 URL이 아닙니다.").optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  tags: z.array(z.string().trim().min(1)).max(10, "태그는 최대 10개까지 가능합니다.").optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

/** 게시글 수정 입력 검증 — 모든 필드 선택적 (부분 업데이트) */
export const updatePostSchema = createPostSchema.partial();

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const updatePostStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export type UpdatePostStatusInput = z.infer<typeof updatePostStatusSchema>;

/** 게시글 목록 조회 쿼리 검증 */
export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  category: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  q: z.string().trim().optional(),
  sort: z.enum(["latest", "popular"]).optional().default("latest"),
  authorId: z.string().cuid().optional(),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
