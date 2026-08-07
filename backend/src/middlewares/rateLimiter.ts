import rateLimit from "express-rate-limit";

/**
 * 전역 Rate Limiter
 *
 * 동일 IP에서 15분 동안 100회 초과 요청 시 429(Too Many Requests) 응답.
 * 로그인처럼 더 엄격하게 제한이 필요한 라우트는 별도의 rate limiter를
 * (예: authRateLimiter) 라우트 레벨에서 추가로 적용합니다.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  limit: 100,
  standardHeaders: true, // RateLimit-* 헤더로 클라이언트에 남은 요청 수 안내
  legacyHeaders: false,
  message: {
    success: false,
    message: "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.",
  },
});
