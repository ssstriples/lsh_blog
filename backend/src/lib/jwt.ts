import jwt, { SignOptions } from "jsonwebtoken";

export interface AccessTokenPayload {
  sub: string; // userId
  role: "ADMIN" | "USER";
}

export interface RefreshTokenPayload {
  sub: string; // userId
}

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";

export function signAccessToken(payload: AccessTokenPayload): string {
  const secret = process.env.JWT_ACCESS_SECRET as string;
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_EXPIRES_IN };
  return jwt.sign(payload, secret, options);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET as string;
  const options: SignOptions = { expiresIn: REFRESH_TOKEN_EXPIRES_IN };
  return jwt.sign(payload, secret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = process.env.JWT_ACCESS_SECRET as string;
  return jwt.verify(token, secret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const secret = process.env.JWT_REFRESH_SECRET as string;
  return jwt.verify(token, secret) as RefreshTokenPayload;
}

/** 쿠키 만료 시간(ms) — REFRESH_TOKEN_EXPIRES_IN(7d)과 반드시 일치시켜야 함 */
export const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
