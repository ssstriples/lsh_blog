import { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { AppError } from "@/middlewares/errorHandler";
import type { AuthUser } from "@/middlewares/authMiddleware";
import type { AdminUsersQuery } from "@/schemas/adminSchema";

/** ⚠️ password는 절대 select하지 않는다 */
const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  _count: {
    select: {
      posts: { where: { deletedAt: null } },
      comments: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.UserSelect;

/** GET /api/admin/users — 전체 회원 (탈퇴 제외, 최신 가입순) */
export async function listUsersForAdmin(query: AdminUsersQuery) {
  const { page, limit, q, status } = query;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: ADMIN_USER_SELECT,
    }),
    prisma.user.count({ where }),
  ]);

  const users = rows.map(({ _count, ...user }) => ({
    ...user,
    postCount: _count.posts,
    commentCount: _count.comments,
  }));

  return {
    users,
    pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
  };
}

/**
 * PATCH /api/admin/users/:id/status — 회원 정지/해제
 * - 본인 계정은 변경 불가 (실수로 자신을 정지해 관리자가 사라지는 것 방지)
 * - 다른 ADMIN 계정도 변경 불가 (관리자끼리 서로 정지하는 상황 방지 — 관리자 강등은 DB에서 직접)
 * 정지 효과: 로그인/토큰 재발급 거부(authService/authController), 글쓰기·댓글 작성 차단(requireActiveUser 등).
 */
export async function updateUserStatus(actor: AuthUser, targetId: string, status: UserStatus) {
  if (actor.id === targetId) {
    throw new AppError("본인 계정의 상태는 변경할 수 없습니다.", 400);
  }

  const target = await prisma.user.findFirst({
    where: { id: targetId, deletedAt: null },
    select: { email: true, role: true },
  });
  if (!target) throw new AppError("회원을 찾을 수 없습니다.", 404);
  if (target.role === "ADMIN") {
    throw new AppError("관리자 계정은 정지할 수 없습니다.", 403);
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { status },
    select: ADMIN_USER_SELECT,
  });

  // 🔐 보안 로그 — 누가 누구를 정지/해제했는지 남긴다
  logger.warn(`[관리자] 회원 상태 변경: ${target.email} (${targetId}) → ${status} by ${actor.id}`);

  const { _count, ...user } = updated;
  return { ...user, postCount: _count.posts, commentCount: _count.comments };
}
