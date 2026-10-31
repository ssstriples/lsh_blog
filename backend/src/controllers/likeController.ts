import crypto from "crypto";
import { Request, Response, NextFunction, CookieOptions } from "express";
import { getLikeStatus, toggleLike, type LikeIdentity } from "@/services/likeService";

const GUEST_ID_COOKIE_NAME = "guestId";
const GUEST_ID_PATTERN = /^[0-9a-f-]{36}$/; // crypto.randomUUID() 형식만 신뢰한다

const guestIdCookieOptions: CookieOptions = {
  httpOnly: true, // JS에서 읽을 필요가 없다 — 서버만 식별용으로 사용
  secure: process.env.NODE_ENV === "production",
  // 프론트(:3000)와 백엔드(:4100)는 포트만 다른 "같은 사이트"라 Lax로 fetch에 실린다.
  // ⚠️ 배포 시 프론트/백엔드 도메인이 서로 다르면(cross-site) "none" + secure로 바꿔야 한다 (Phase 8).
  sameSite: "lax",
  path: "/api/posts", // 좋아요 라우트에만 실려 가도록 범위를 좁힌다
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1년
};

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function readGuestId(req: Request): string | null {
  const value = req.cookies?.[GUEST_ID_COOKIE_NAME];
  return typeof value === "string" && GUEST_ID_PATTERN.test(value) ? value : null;
}

/** GET /api/posts/:postId/like — 🔓 내 좋아요 여부 + 전체 좋아요 수 */
export async function status(req: Request, res: Response, next: NextFunction) {
  try {
    const guestId = readGuestId(req);
    const identity: LikeIdentity | null = req.user
      ? { userId: req.user.id }
      : guestId
        ? { guestId }
        : null;

    const result = await getLikeStatus(paramId(req.params.postId), identity);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** POST /api/posts/:postId/like — 🔓 좋아요 토글 (로그인 유저는 계정, 비로그인은 guestId 쿠키 기준) */
export async function toggle(req: Request, res: Response, next: NextFunction) {
  try {
    let identity: LikeIdentity;

    if (req.user) {
      identity = { userId: req.user.id };
    } else {
      let guestId = readGuestId(req);
      if (!guestId) {
        // 첫 좋아요 — 서버가 랜덤 ID를 만들어 쿠키로 심는다 (클라이언트가 임의 ID를 지정할 수 없게)
        guestId = crypto.randomUUID();
        res.cookie(GUEST_ID_COOKIE_NAME, guestId, guestIdCookieOptions);
      }
      identity = { guestId };
    }

    const result = await toggleLike(paramId(req.params.postId), identity);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
