import { Router } from "express";
import { signup, login, refresh, logout } from "@/controllers/authController";
import { requireAuth } from "@/middlewares/authMiddleware";
import { signupRateLimiter, loginRateLimiter } from "@/middlewares/authRateLimiter";

const router = Router();

router.post("/signup", signupRateLimiter, signup);
router.post("/login", loginRateLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", requireAuth, logout);

export default router;
