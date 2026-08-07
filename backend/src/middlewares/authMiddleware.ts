import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";
import { verifyAccessToken } from "@/lib/jwt";

export interface AuthUser {
  id: string;
  role: "ADMIN" | "USER";
}

// Express Request에 user 속성을 추가하기 위한 타입 확장
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authorization: Bearer <accessToken> 헤더를 검증하고,
 * 성공 시 req.user에 { id, role }을 채워 넣는다.
 * 토큰이 없거나 유효하지 않으면 401을 반환한다.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError("로그인이 필요합니다.", 401);
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new AppError("토큰이 유효하지 않거나 만료되었습니다.", 401);
  }
}

/**
 * 로그인은 되어있지 않아도 되지만, 되어있다면 req.user를 채워주는 선택적 인증.
 * (예: 게스트도 볼 수 있는 글 목록에서, 로그인 유저에게는 "내 글" 표시를 추가하는 경우)
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // 토큰이 유효하지 않아도 그냥 비로그인으로 취급하고 통과시킨다.
    }
  }

  next();
}

/** 관리자 전용 라우트에 사용. requireAuth 이후에 사용해야 함. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "ADMIN") {
    throw new AppError("관리자만 접근할 수 있습니다.", 403);
  }
  next();
}
