import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";
import { adminUsersQuerySchema, updateUserStatusSchema } from "@/schemas/adminSchema";
import { getDashboardStats } from "@/services/dashboardService";
import { listUsersForAdmin, updateUserStatus } from "@/services/userAdminService";

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

/** GET /api/admin/dashboard — 🛡️ 통계 (총 회원/게시글/조회수/댓글, 인기글 Top5, 최근 댓글, 14일 조회수 추이) */
export async function dashboard(_req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await getDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/users — 🛡️ 전체 회원 목록 */
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseOrThrow(adminUsersQuerySchema, req.query);
    const result = await listUsersForAdmin(query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/users/:id/status — 🛡️ 회원 정지(SUSPENDED)/해제(ACTIVE) */
export async function changeUserStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = parseOrThrow(updateUserStatusSchema, req.body);
    const user = await updateUserStatus(req.user!, paramId(req.params.id), status);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}
