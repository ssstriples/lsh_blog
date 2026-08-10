import { Router } from "express";
import { requireAuth, requireAdmin } from "@/middlewares/authMiddleware";
import { adminListAllPosts, adminForceDeletePost } from "@/controllers/postController";

const router = Router();

// 🛡️ 관리자 전용 — 모더레이션 목적 (소유권과 무관하게 전체 게시글 접근/삭제)
router.get("/posts", requireAuth, requireAdmin, adminListAllPosts);
router.delete("/posts/:id", requireAuth, requireAdmin, adminForceDeletePost);

export default router;
