import { Request, Response, NextFunction } from "express";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middlewares/errorHandler";
import { signupSchema, loginSchema } from "@/schemas/authSchema";
import { signupUser, loginUser } from "@/services/authService";
import {
  signAccessToken,
  verifyRefreshToken,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
} from "@/lib/jwt";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth/refresh",
  maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
};

export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.", 400);
    }

    const user = await signupUser(parsed.data);

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.", 400);
    }

    const result = await loginUser(parsed.data);
    if (!result) return; // TypeScript narrowing (loginUser는 실패 시 항상 throw함)

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, result.refreshToken, refreshCookieOptions);

    res.status(200).json({
      success: true,
      // ⚠️ refreshToken을 JSON 바디에도 함께 반환하는 이유:
      // 프론트엔드(Next.js)의 NextAuth는 서버 사이드(authorize())에서 이 API를 호출하는데,
      // 이 경우 응답의 Set-Cookie는 브라우저가 아닌 Next.js 서버가 받기 때문에
      // 브라우저 → 백엔드로 직접 쿠키가 전달되지 않는다. 대신 NextAuth가 자체적으로
      // 암호화된 HttpOnly 세션(JWT)에 refreshToken을 안전하게 보관하고, 토큰 갱신 시점에
      // 서버(Route Handler)에서 Cookie 헤더로 되돌려 보내는 방식으로 사용한다.
      // (직접 fetch로 백엔드를 호출하는 클라이언트는 기존처럼 HttpOnly 쿠키만 사용하면 된다.)
      data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (!token) {
      throw new AppError("리프레시 토큰이 없습니다. 다시 로그인해주세요.", 401);
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new AppError("리프레시 토큰이 유효하지 않습니다. 다시 로그인해주세요.", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || user.status === "SUSPENDED") {
      throw new AppError("계정을 사용할 수 없습니다. 다시 로그인해주세요.", 401);
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    res.status(200).json({ success: true, data: { accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: "/api/auth/refresh" });
  res.status(200).json({ success: true, message: "로그아웃되었습니다." });
}
