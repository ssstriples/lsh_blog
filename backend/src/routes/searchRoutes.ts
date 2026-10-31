import { Router } from "express";
import { search } from "@/controllers/postController";

const router = Router();

// 🔓 공개 — 제목+본문 검색
router.get("/", search);

export default router;
