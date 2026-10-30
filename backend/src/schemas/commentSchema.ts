import { z } from "zod";

/**
 * 댓글 작성 입력 검증
 * - userId는 포함하지 않는다 — 로그인 유저라면 서버가 req.user.id로 강제 설정한다.
 * - guestName/guestPassword는 비로그인일 때만 필수 (로그인 여부는 서비스에서 판단, 로그인 상태면 무시).
 */
export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "댓글 내용을 입력해주세요.")
    .max(1000, "댓글은 1000자 이내로 작성해주세요."),
  parentId: z.string().cuid().optional().nullable(),
  guestName: z
    .string()
    .trim()
    .min(2, "닉네임은 2자 이상이어야 합니다.")
    .max(20, "닉네임은 20자 이내여야 합니다.")
    .optional(),
  guestPassword: z
    .string()
    .min(4, "비밀번호는 4자 이상이어야 합니다.")
    .max(20, "비밀번호는 20자 이내여야 합니다.")
    .optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/** 게스트 댓글 삭제 — 작성 시 입력한 비밀번호 확인 */
export const deleteGuestCommentSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

/** 관리자 전체 댓글 목록 쿼리 (q = 내용/작성자명 검색) */
export const adminCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().trim().optional(),
});

export type AdminCommentsQuery = z.infer<typeof adminCommentsQuerySchema>;
