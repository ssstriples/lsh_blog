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
] as const;

export function validateEnv(): void {
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
