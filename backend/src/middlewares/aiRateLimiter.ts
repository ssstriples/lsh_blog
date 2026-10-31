import rateLimit from "express-rate-limit";

/**
 * AI 초안 생성 Rate Limiter — 1시간에 10회
 * 요청 하나하나가 실제 비용(토큰 과금)이 드는 작업이라, 관리자 전용이어도 실수로 연타하거나
 * 토큰이 유출됐을 때의 피해 상한을 둔다. 실패한 요청(400 검증 오류 등)은 세지 않는다.
 */
export const aiDraftRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  message: {
    success: false,
    message: "AI 초안 생성은 1시간에 10회까지 가능합니다. 잠시 후 다시 시도해주세요.",
  },
});
