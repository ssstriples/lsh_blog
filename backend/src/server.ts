import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { validateEnv } from "@/lib/validateEnv";
// 🔐 서버 시작 전 필수 환경변수 검증 (누락 시 즉시 종료)
validateEnv();

import { createApp } from "@/app";
import { logger } from "@/lib/logger";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4100;

const app = createApp();

app.listen(PORT, () => {
  logger.info(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
