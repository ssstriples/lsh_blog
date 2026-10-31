import Anthropic from "@anthropic-ai/sdk";

/** AI 기능 전체에서 쓰는 모델 — 바꿀 때는 여기 한 곳만 고친다 */
export const AI_MODEL = "claude-opus-5-5";

/**
 * 거절(refusal) 시 서버 측 폴백 — 안전 분류기가 요청을 거절하면 같은 요청을 Anthropic이 고른 다른 모델로
 * 한 번 더 실행한다 ("default" 모드는 거절 카테고리별로 대상을 고르므로 모델 목록을 관리할 필요가 없다).
 * 이 모드는 반드시 아래 베타 헤더와 짝으로 보내야 한다 (다른 server-side-fallback 헤더와 섞으면 400).
 */
export const AI_FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

let client: Anthropic | null = null;

/** ANTHROPIC_API_KEY가 설정돼 있을 때만 AI 기능을 켠다 (선택 환경변수 — validateEnv.ts) */
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** 첫 호출 시 클라이언트를 만든다 — 키가 없는 환경에서도 서버는 정상 기동해야 하므로 지연 생성 */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    // apiKey를 넘기지 않으면 SDK가 ANTHROPIC_API_KEY 환경변수를 읽는다.
    // 재시도: 429/5xx/연결 오류는 SDK가 기본 2회 재시도한다.
    client = new Anthropic();
  }
  return client;
}
