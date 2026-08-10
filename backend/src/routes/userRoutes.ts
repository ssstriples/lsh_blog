import { Router } from "express";
import { requireAuth } from "@/middlewares/authMiddleware";
import { myPosts, postsByAuthor } from "@/controllers/postController";

const router = Router();

// 🔒 마이페이지 — 본인 글 목록 (DRAFT 포함)
router.get("/me/posts", requireAuth, myPosts);

// 🔓 특정 작성자의 공개 글 목록 (프로필 페이지용)
router.get("/:id/posts", postsByAuthor);

export default router;
