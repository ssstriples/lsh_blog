import { Router } from "express";
import {
  create,
  update,
  updateStatus,
  remove,
  list,
  detail,
  detailById,
  uploadPostImage,
} from "@/controllers/postController";
import { list as listComments, create as createComment } from "@/controllers/commentController";
import { requireAuth, optionalAuth } from "@/middlewares/authMiddleware";
import { requireOwnership } from "@/middlewares/ownershipMiddleware";
import { uploadImageMiddleware } from "@/middlewares/uploadMiddleware";
import { commentRateLimiter } from "@/middlewares/commentRateLimiter";
import { getPostAuthorId } from "@/services/postService";

const router = Router();

const ownershipCheck = requireOwnership((req) => getPostAuthorId(req.params.id as string));

// 🔓 공개
router.get("/", list);
router.get("/:slug", detail);

// 💬 댓글 — 조회는 공개, 작성은 로그인 유저 또는 게스트(닉네임+비밀번호). 스팸 방지 10회/1분
router.get("/:postId/comments", listComments);
router.post("/:postId/comments", commentRateLimiter, optionalAuth, createComment);

// 🔒 로그인 필요 — 생성은 누구나, authorId는 서버가 req.user.id로 강제 설정
router.post("/", requireAuth, create);

// 🔒 로그인 유저 누구나 — 에디터 이미지 업로드 (Cloudinary)
router.post("/upload-image", requireAuth, uploadImageMiddleware, uploadPostImage);

// 🔑 로그인 + 소유권 검증 (본인 글만, ADMIN 예외)
// 수정 화면 진입용 조회 — DRAFT도 내려주므로 반드시 소유권 검증 뒤에 둔다
router.get("/:id/edit", requireAuth, ownershipCheck, detailById);
router.patch("/:id", requireAuth, ownershipCheck, update);
router.patch("/:id/status", requireAuth, ownershipCheck, updateStatus);
router.delete("/:id", requireAuth, ownershipCheck, remove);

export default router;
