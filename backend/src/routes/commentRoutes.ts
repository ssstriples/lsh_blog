import { Router } from "express";
import { remove, removeAsGuest } from "@/controllers/commentController";
import { requireAuth } from "@/middlewares/authMiddleware";
import { requireOwnership } from "@/middlewares/ownershipMiddleware";
import { guestCommentDeleteRateLimiter } from "@/middlewares/commentRateLimiter";
import { getCommentOwnerId } from "@/services/commentService";

const router = Router();

// 🔑 로그인 + 소유권 검증 (본인 댓글만, ADMIN 예외 — 게스트 댓글도 ADMIN은 삭제 가능)
router.delete(
  "/:id",
  requireAuth,
  requireOwnership((req) => getCommentOwnerId(req.params.id as string)),
  remove,
);

// 🔓 게스트 댓글 — 작성 시 입력한 비밀번호로 삭제 (무차별 대입 방지 Rate Limit)
router.post("/:id/guest-delete", guestCommentDeleteRateLimiter, removeAsGuest);

export default router;
