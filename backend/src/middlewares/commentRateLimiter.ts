import rateLimit from "express-rate-limit";

/**
 * 댓글 작성 Rate Limiter — 1분에 10회 (스팸 방지, 02_tech_spec_detail.md 보안 항목)
 * 게스트 댓글도 허용하므로 계정이 아닌 IP 기준으로 제한한다.
 */
export const commentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "댓글을 너무 자주 작성하고 있습니다. 잠시 후 다시 시도해주세요.",
  },
});

/**
 * 게스트 댓글 삭제 Rate Limiter — 15분에 10회 실패까지 (비밀번호 무차별 대입 방지)
 * 게스트 비밀번호는 4자 이상이면 되는 "간단 비밀번호"라 대입 공격에 특히 취약하다.
 * 성공한 요청은 카운트에서 제외한다.
 */
export const guestCommentDeleteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "비밀번호 확인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
  },
});
