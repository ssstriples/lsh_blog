import { CorsOptions } from "cors";

/**
 * CORS 허용 출처(Origin) 설정
 *
 * `*`(모든 출처 허용) 대신, 환경변수 `CORS_ORIGIN`에 등록된 도메인만 명시적으로 허용합니다.
 * 여러 출처를 허용해야 한다면 쉼표(,)로 구분해서 등록합니다.
 * 예) CORS_ORIGIN=http://localhost:3000,https://lsh-blog.vercel.app
 */
const allowedOrigins = (process.env.CORS_ORIGIN ?? "").split(",").map((o) => o.trim());

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // origin이 없는 경우(Postman, 서버 간 통신 등)는 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 정책에 의해 차단된 출처입니다: ${origin}`));
    }
  },
  credentials: true, // 쿠키(Refresh Token) 전송 허용
};
