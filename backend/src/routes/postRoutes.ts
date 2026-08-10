import { Router } from "express";
import {
  create,
  update,
  updateStatus,
  remove,
  list,
  detail,
} from "@/controllers/postController";
import { requireAuth } from "@/middlewares/authMiddleware";
import { requireOwnership } from "@/middlewares/ownershipMiddleware";
import { getPostAuthorId } from "@/services/postService";

const router = Router();

const ownershipCheck = requireOwnership((req) => getPostAuthorId(req.params.id as string));

// 🔓 공개
router.get("/", list);
router.get("/:slug", detail);

// 🔒 로그인 필요 — 생성은 누구나, authorId는 서버가 req.user.id로 강제 설정
router.post("/", requireAuth, create);

// 🔑 로그인 + 소유권 검증 (본인 글만, ADMIN 예외)
router.patch("/:id", requireAuth, ownershipCheck, update);
router.patch("/:id/status", requireAuth, ownershipCheck, updateStatus);
router.delete("/:id", requireAuth, ownershipCheck, remove);

export default router;
