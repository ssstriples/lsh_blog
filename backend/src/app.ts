import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

import { corsOptions } from "@/lib/cors";
import { globalRateLimiter } from "@/middlewares/rateLimiter";
import { errorHandler, notFoundHandler } from "@/middlewares/errorHandler";

export function createApp() {
  const app = express();

  // 🔐 보안 헤더 (XSS, clickjacking 등 방지)
  app.use(helmet());

  // 🔐 CORS — 허용된 출처만 API 접근 가능
  app.use(cors(corsOptions));

  // 🔐 전역 Rate Limiting — 과도한 요청으로부터 서버 보호
  app.use(globalRateLimiter);

  // Body 파서
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 헬스체크 라우트 (배포 환경에서 서버 생존 확인용)
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: "OK" });
  });

  // TODO: 이후 Phase에서 아래에 실제 라우트를 추가합니다.
  // app.use("/api/auth", authRouter);
  // app.use("/api/posts", postRouter);

  // 404 핸들러 (등록된 라우트가 없을 때)
  app.use(notFoundHandler);

  // 전역 에러 핸들러 (반드시 마지막에 등록)
  app.use(errorHandler);

  return app;
}
