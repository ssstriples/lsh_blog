import { Router } from "express";
import { list } from "@/controllers/categoryController";

const router = Router();

// 🔓 공개
router.get("/", list);

export default router;
