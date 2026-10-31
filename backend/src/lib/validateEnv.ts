/**
 * 서버 시작 시 필수 환경변수가 모두 설정되어 있는지 검증합니다.
 * 하나라도 누락되면 서버를 아예 시작하지 않고 즉시 종료시켜,
 * "배포는 됐는데 런타임에 갑자기 죽는" 상황을 방지합니다.
 */
const REQUIRED_ENV_VARS = [
  "PORT",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CORS_ORIGIN",
  "DATABASE_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

/**
 * 선택 환경변수 — 없어도 서버는 뜨지만 해당 기능만 꺼진다 (시작 시 경고로 알려준다).
 * - ANTHROPIC_API_KEY: AI 초안 생성(/api/admin/ai/*), AI 명세서 파이프라인 CLI
 */
const OPTIONAL_ENV_VARS: { key: string; feature: string }[] = [
  { key: "ANTHROPIC_API_KEY", feature: "AI 초안 생성 / AI 명세서 파이프라인" },
];

export function validateEnv(): void {
  for (const { key, feature } of OPTIONAL_ENV_VARS) {
    if (!process.env[key]) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️  선택 환경변수 ${key}가 없어 "${feature}" 기능이 비활성화됩니다.`);
    }
  }

  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `❌ 필수 환경변수가 설정되지 않았습니다: ${missing.join(", ")}\n` +
        `   .env 파일을 확인하거나 .env.example을 참고해 값을 채워주세요.`,
    );
    process.exit(1);
  }
}
