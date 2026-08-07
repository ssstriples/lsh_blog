import rateLimit from "express-rate-limit";

/**
 * 회원가입 Rate Limiter — 1시간에 5회 (대량 가입/봇 방지)
 */
export const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "회원가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.",
  },
});

/**
 * 로그인 Rate Limiter — 15분에 5회 (무차별 대입 공격 방지)
 * 성공한 요청은 카운트에서 제외(skipSuccessfulRequests)하여,
 * 정상적으로 로그인에 성공한 사용자는 계속 제한에 걸리지 않도록 함.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
  },
});
