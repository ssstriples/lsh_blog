import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";
import {
  createCommentSchema,
  deleteGuestCommentSchema,
  adminCommentsQuerySchema,
} from "@/schemas/commentSchema";
import {
  listComments,
  createComment,
  softDeleteComment,
  deleteGuestComment,
  listAllCommentsForAdmin,
} from "@/services/commentService";

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: any } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error?.issues?.[0]?.message ?? "입력값이 올바르지 않습니다.";
    throw new AppError(message, 400);
  }
  return parsed.data as T;
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

/** GET /api/posts/:postId/comments — 🔓 공개 (대댓글 포함 트리) */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listComments(paramId(req.params.postId));
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** POST /api/posts/:postId/comments — 🔓 로그인 유저 또는 게스트(닉네임+비밀번호) */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseOrThrow(createCommentSchema, req.body);
    const comment = await createComment(paramId(req.params.postId), input, req.user);
    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/comments/:id — 🔑 본인 댓글만 (ADMIN 예외), 소유권 검증은 라우트의 requireOwnership */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await softDeleteComment(paramId(req.params.id));
    res.status(200).json({ success: true, message: "댓글이 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}

/** POST /api/comments/:id/guest-delete — 🔓 게스트 댓글을 작성 시 비밀번호로 삭제 */
export async function removeAsGuest(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = parseOrThrow(deleteGuestCommentSchema, req.body);
    await deleteGuestComment(paramId(req.params.id), password);
    res.status(200).json({ success: true, message: "댓글이 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/comments — 🛡️ 전체 댓글 (모더레이션용) */
export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseOrThrow(adminCommentsQuerySchema, req.query);
    const result = await listAllCommentsForAdmin(query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/comments/:id — 🛡️ 관리자 강제 삭제 (소유권 무관) */
export async function adminRemove(req: Request, res: Response, next: NextFunction) {
  try {
    await softDeleteComment(paramId(req.params.id));
    res.status(200).json({ success: true, message: "관리자 권한으로 댓글이 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}
