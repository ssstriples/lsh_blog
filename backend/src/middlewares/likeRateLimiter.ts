import rateLimit from "express-rate-limit";

/**
 * 좋아요 토글 Rate Limiter — 1분에 30회 (IP 기준)
 * 게스트는 쿠키를 지우면 다시 누를 수 있으므로, 쿠키 삭제 + 반복 클릭으로 숫자를 부풀리는 것을 늦춘다.
 */
export const likeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  },
});
