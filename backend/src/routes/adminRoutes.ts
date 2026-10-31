import { Router } from "express";
import { requireAuth, requireAdmin } from "@/middlewares/authMiddleware";
import { adminListAllPosts, adminForceDeletePost } from "@/controllers/postController";
import { create as createCategory, update as updateCategory, remove as removeCategory } from "@/controllers/categoryController";
import { adminList as adminListComments, adminRemove as adminRemoveComment } from "@/controllers/commentController";
import { dashboard, listUsers, changeUserStatus } from "@/controllers/adminController";

const router = Router();

// 🛡️ 관리자 전용 — 대시보드 통계
router.get("/dashboard", requireAuth, requireAdmin, dashboard);

// 🛡️ 관리자 전용 — 회원 관리 (목록 / 정지·해제)
router.get("/users", requireAuth, requireAdmin, listUsers);
router.patch("/users/:id/status", requireAuth, requireAdmin, changeUserStatus);

// 🛡️ 관리자 전용 — 모더레이션 목적 (소유권과 무관하게 전체 게시글 접근/삭제)
router.get("/posts", requireAuth, requireAdmin, adminListAllPosts);
router.delete("/posts/:id", requireAuth, requireAdmin, adminForceDeletePost);

// 🛡️ 관리자 전용 — 댓글 모더레이션 (전체 조회 / 소유권 무관 강제 삭제)
router.get("/comments", requireAuth, requireAdmin, adminListComments);
router.delete("/comments/:id", requireAuth, requireAdmin, adminRemoveComment);

// 🛡️ 관리자 전용 — 카테고리 생성/수정/삭제 (조회는 /api/categories에서 공개)
router.post("/categories", requireAuth, requireAdmin, createCategory);
router.patch("/categories/:id", requireAuth, requireAdmin, updateCategory);
router.delete("/categories/:id", requireAuth, requireAdmin, removeCategory);

export default router;
