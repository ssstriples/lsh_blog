import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";

/**
 * 소유권 검증 미들웨어 팩토리
 *
 * 리소스(게시글/댓글 등)의 소유자 ID를 조회하는 함수를 주입받아,
 * 로그인한 사용자(req.user.id)와 일치하는지 검증한다.
 * ADMIN 역할은 예외적으로 모든 리소스에 접근 가능하다 (모더레이션 목적).
 *
 * requireAuth 미들웨어 이후에 사용해야 한다 (req.user가 채워져 있어야 함).
 *
 * @param getOwnerId - 요청으로부터 리소스를 조회하고, 소유자의 userId를 반환하는 함수.
 *                     리소스가 존재하지 않으면 null을 반환해야 한다 (404 처리).
 */
export function requireOwnership(
  getOwnerId: (req: Request) => Promise<string | null>,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError("로그인이 필요합니다.", 401);
      }

      const ownerId = await getOwnerId(req);

      if (ownerId === null) {
        throw new AppError("요청하신 리소스를 찾을 수 없습니다.", 404);
      }

      const isOwner = ownerId === req.user.id;
      const isAdmin = req.user.role === "ADMIN";

      if (!isOwner && !isAdmin) {
        throw new AppError("본인이 작성한 콘텐츠만 수정/삭제할 수 있습니다.", 403);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
