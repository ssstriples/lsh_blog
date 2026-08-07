# Phase 0-3: 백엔드 초기 세팅 (T010~T013-S5)

> 관련 태스크: `T010`, `T011`, `T012`, `T013`, `T013-S`, `T013-S2`, `T013-S3`, `T013-S4`, `T013-S5`
> 작업일: 2026-08-07
> 결과물 위치: `backend/`

## 1. 목표

Express + TypeScript 기반 백엔드 서버의 뼈대를 만들고, 실무에서 필수로 여겨지는
5가지 보안/운영 미들웨어(Helmet, Rate Limiting, 전역 에러 핸들러, 로거, CORS 제한)까지
초기 세팅 단계에서 미리 갖춘다.

---

## 2. T010 — Express 프로젝트 생성

```bash
mkdir backend && cd backend
pnpm init
```

`package.json`이 최소 형태로 생성됩니다. 이후 필요한 패키지들을 하나씩 설치합니다.

---

## 3. T011 — 핵심 패키지 설치 및 서버 구성

### 설치한 패키지

```bash
# 런타임 의존성
pnpm add express cors dotenv helmet express-rate-limit winston

# 개발 의존성 (TypeScript 실행/빌드 환경)
pnpm add -D typescript ts-node ts-node-dev nodemon tsconfig-paths \
  @types/node @types/express @types/cors
```

| 패키지 | 역할 |
|---|---|
| `express` | 웹 서버 프레임워크 (v5 — 비동기 에러 처리가 개선된 최신 메이저 버전) |
| `cors` | 다른 출처(Origin)의 요청 허용 여부를 제어 |
| `dotenv` | `.env` 파일의 값을 `process.env`로 로드 |
| `helmet` | 보안 관련 HTTP 헤더를 한 번에 설정해주는 미들웨어 |
| `express-rate-limit` | 특정 IP의 과도한 요청을 제한 (DDoS/무차별 대입 공격 방어) |
| `winston` | 구조화된 로그를 콘솔 및 파일에 기록하는 로거 |
| `ts-node` | TypeScript 코드를 컴파일 없이 바로 실행 (개발 중 사용) |
| `tsconfig-paths` | `tsconfig.json`의 `@/*` 별칭을 `ts-node`/Node.js 런타임에서도 인식하게 해줌 |

### `app.ts` / `server.ts`로 파일을 나눈 이유

- `app.ts`: Express 앱 자체(미들웨어, 라우트 등록)만 정의 — **테스트 코드에서 서버를 실제로 띄우지 않고도** import해서 테스트할 수 있음
- `server.ts`: 환경변수 로드 → 검증 → `app.listen()`으로 실제 서버 구동 — **실행(entry point)** 역할만 담당

```ts
// src/app.ts (핵심 발췌)
export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(globalRateLimiter);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => res.status(200).json({ success: true, message: "OK" }));

  app.use(notFoundHandler);
  app.use(errorHandler); // 반드시 가장 마지막에 등록
  return app;
}
```

```ts
// src/server.ts (핵심 발췌)
import dotenv from "dotenv";
dotenv.config({ quiet: true });

import { validateEnv } from "@/lib/validateEnv";
validateEnv(); // 필수 환경변수 검증 (T020-S3 연계)

import { createApp } from "@/app";
const app = createApp();
app.listen(PORT, () => logger.info(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`));
```

> 💡 **미들웨어 등록 순서가 중요한 이유**: Express는 `app.use()`로 등록한 순서대로 요청을 처리합니다.
> `errorHandler`를 가장 나중에 등록해야, 그 이전 모든 미들웨어/라우트에서 발생한 에러를 캐치할 수 있습니다.

---

## 4. T012 — 폴더 구조 설계

```
backend/src/
├── app.ts            # Express 앱 정의
├── server.ts          # 서버 실행 entry point
├── routes/            # 라우트 정의 (예: authRouter, postRouter)
├── controllers/        # 요청(req)을 받아 서비스 호출 후 응답(res) 반환
├── services/           # 실제 비즈니스 로직 (DB 조회, 계산 등)
├── middlewares/        # 인증, 에러 처리, rate limit 등 공통 미들웨어
├── schemas/            # Zod 등 입력값 검증 스키마
└── lib/                # 로거, CORS 설정, 환경변수 검증 등 유틸
```

> **왜 controller와 service를 나누나요?**
> Controller는 "HTTP 요청/응답"만 다루고, Service는 "실제 로직"만 다루도록 역할을 분리하면
> 나중에 이 로직을 CLI 스크립트나 다른 API에서도 재사용하기 쉬워집니다.

---

## 5. T013 — `nodemon` + `ts-node` 개발 서버 설정

파일을 저장할 때마다 서버가 자동으로 재시작되도록 설정합니다.

```jsonc
// nodemon.json
{
  "watch": ["src"],
  "ext": "ts",
  "ignore": ["src/**/*.spec.ts"],
  "exec": "ts-node -r tsconfig-paths/register src/server.ts"
}
```

```json
// package.json scripts
{
  "dev": "nodemon",
  "build": "tsc -p tsconfig.json",
  "start": "node -r tsconfig-paths/register dist/server.js"
}
```

- `pnpm run dev` → 개발 중 (자동 재시작)
- `pnpm run build` → TypeScript를 `dist/`에 JS로 컴파일 (배포용)
- `pnpm run start` → 컴파일된 JS를 실제로 실행 (배포 환경)

---

## 6. T013-S — Helmet 보안 헤더

```ts
app.use(helmet());
```

`helmet()` 한 줄만으로 아래와 같은 다양한 보안 헤더가 자동 설정됩니다.

| 헤더 | 방어하는 공격 |
|---|---|
| `X-Content-Type-Options: nosniff` | 브라우저가 파일 타입을 임의로 추측(MIME sniffing)해서 악성 스크립트를 실행하는 것 방지 |
| `X-Frame-Options` / CSP `frame-ancestors` | 내 사이트를 iframe에 몰래 삽입해 클릭을 유도하는 **클릭재킹** 방지 |
| `Strict-Transport-Security` (HSTS) | HTTP로 접속해도 강제로 HTTPS로 리다이렉트 |

> 💡 **초보자 Tip**: 이런 헤더들을 하나하나 직접 설정하는 건 실수하기 쉬워서,
> 업계에서 검증된 기본값을 제공하는 `helmet` 같은 라이브러리를 쓰는 것이 안전합니다.

---

## 7. T013-S2 — 전역 Rate Limiting

```ts
// src/middlewares/rateLimiter.ts
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  limit: 100,               // 최대 100회
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요." },
});
```

- 같은 IP가 **15분 동안 100번 넘게** 요청하면 `429 Too Many Requests` 응답을 돌려줍니다.
- 로그인처럼 더 엄격한 제한이 필요한 라우트(5회/15분)는 Phase 2에서 별도 rate limiter를 라우트 단위로 추가할 예정입니다.

> 💡 **Rate Limiting이 필요한 이유**: 공격자가 짧은 시간에 수천 번 요청을 보내
> 서버를 마비시키거나(DDoS), 로그인 비밀번호를 무작위로 대입(Brute-force)하는 것을 막아줍니다.

---

## 8. T013-S3 — 전역 에러 핸들러

```ts
// src/middlewares/errorHandler.ts
export class AppError extends Error {
  constructor(message: string, public statusCode = 500, public isOperational = true) {
    super(message);
  }
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;

  logger.error(`[${req.method} ${req.originalUrl}] ${err.message}`, { stack: err.stack });

  res.status(statusCode).json({
    success: false,
    // 예상된 에러(AppError)만 실제 메시지를 보여주고, 그 외에는 일반 메시지만 노출
    message: isOperational ? err.message : "서버 내부 오류가 발생했습니다.",
  });
}
```

### 왜 스택 트레이스를 클라이언트에 보내면 안 되나요?

스택 트레이스에는 서버의 파일 경로, 함수 이름, 사용 중인 라이브러리 버전 등
**공격자에게 힌트가 되는 정보**가 그대로 담겨 있습니다. 그래서:

- 스택 트레이스는 **서버 로그(winston)에만** 상세히 기록
- 클라이언트에게는 "서버 내부 오류가 발생했습니다" 같은 **일반적인 메시지**만 전달

### `AppError`를 따로 만든 이유

"404 Not Found", "400 잘못된 요청"처럼 **의도적으로 발생시키는 에러**(`isOperational: true`)와,
버그로 인해 **예상치 못하게 터지는 에러**(`isOperational: false`)를 구분하기 위함입니다.
전자는 사용자에게 구체적인 메시지를 보여줘도 안전하지만, 후자는 절대 노출하면 안 됩니다.

---

## 9. T013-S4 — Winston 로거

```ts
// src/lib/logger.ts
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(errors({ stack: true }), timestamp(), logFormat),
  transports: [
    new winston.transports.Console({ format: combine(colorize(), timestamp(), logFormat) }),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});
```

- **콘솔**: 개발 중 실시간으로 색깔 있는 로그 확인
- **`logs/error.log`**: `error` 레벨 이상만 별도 파일에 저장 (장애 원인 추적용)
- **`logs/combined.log`**: 모든 레벨의 로그를 통합 저장

> 💡 **`console.log` 대신 winston을 쓰는 이유**: `console.log`는 로그 레벨 구분, 파일 저장,
> 타임스탬프 자동 삽입 같은 기능이 없어서 실무에서는 winston 같은 전용 로거를 사용합니다.

---

## 10. T013-S5 — CORS 허용 출처 명시적 제한

```ts
// src/lib/cors.ts
const allowedOrigins = (process.env.CORS_ORIGIN ?? "").split(",").map((o) => o.trim());

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 정책에 의해 차단된 출처입니다: ${origin}`));
    }
  },
  credentials: true, // Refresh Token 쿠키 전송 허용
};
```

### `origin: "*"`(모든 출처 허용)을 쓰지 않는 이유

만약 아무 도메인이나 내 API를 호출할 수 있게 허용하면, 악의적인 사이트가
사용자 몰래 내 API에 요청을 보내 데이터를 훔쳐갈 수 있습니다.
그래서 `.env`의 `CORS_ORIGIN`에 **내가 신뢰하는 프론트엔드 주소만** 등록해서 허용합니다.

```env
# .env
CORS_ORIGIN=http://localhost:3000
```

---

## 11. T020-S3 (선반영) — 서버 시작 시 환경변수 검증

Phase 0-5(T020-S3)에서 예정되어 있던 작업이지만, `server.ts`가 정상 동작하려면
필수 환경변수가 반드시 있어야 해서 이번 단계에서 함께 구현했습니다.

```ts
// src/lib/validateEnv.ts
const REQUIRED_ENV_VARS = ["PORT", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CORS_ORIGIN"];

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ 필수 환경변수가 설정되지 않았습니다: ${missing.join(", ")}`);
    process.exit(1); // 서버를 아예 켜지지 않고 즉시 종료
  }
}
```

> 💡 **왜 굳이 서버를 강제 종료시키나요?**
> 환경변수가 없는 상태로 서버가 켜지면, 나중에 로그인 기능을 쓸 때가 되어서야
> "JWT_SECRET이 없어요!" 에러가 발생합니다. 이런 문제는 **서버가 켜지는 즉시** 알아채는 것이
> 운영 중 장애를 훨씬 빨리 발견하는 방법입니다 ("Fail Fast" 원칙).

---

## 12. 트러블슈팅

### 문제 1: TypeScript 7 + ts-node 10.9.2 호환성 오류

```
TypeError: Cannot read properties of undefined (reading 'fileExists')
    at readConfig (...ts-node/dist/configuration.js:91:33)
```

**원인**: `pnpm add -D typescript`로 설치했더니 최신 **TypeScript 7.0.2**가 설치되었는데,
`ts-node@10.9.2`는 아직 TypeScript 7의 내부 API 변경사항과 호환되지 않았습니다.

**해결**: TypeScript를 안정적으로 검증된 **5.9.3** 버전으로 고정했습니다.

```bash
pnpm add -D typescript@5.9.3
```

> 💡 **배운 점**: `pnpm add`로 버전을 명시하지 않으면 항상 최신 버전이 설치됩니다.
> 다른 도구(ts-node 등)와의 호환성이 중요한 패키지는 **버전을 명시적으로 고정**하는 것이 안전합니다.

### 문제 2: `tsconfig.json`의 `moduleResolution` 옵션 오류

TypeScript 7 기준으로 작성했던 `moduleResolution: "Node"`, `baseUrl` 옵션이
TypeScript 5에서는 다른 방식(`Node`/`baseUrl` 조합)을 요구해 아래처럼 정리했습니다.

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "baseUrl": "./src",
    "paths": { "@/*": ["*"] }
  }
}
```

### 문제 3: 터미널에서 `curl`로 서버 응답을 못 받음

서버를 `&`(백그라운드)로 실행했는데 새 명령을 입력하자 프로세스가 함께 죽는 현상이 있었습니다.
**해결**: `nohup`처럼 로그를 파일로 리다이렉트하고 `disown`으로 셸과 분리한 뒤 확인했습니다.

```bash
node -r tsconfig-paths/register -r ts-node/register src/server.ts > /tmp/server.log 2>&1 &
disown
curl http://127.0.0.1:4100/health
```

---

## 13. 최종 검증

```bash
pnpm run build   # ✅ 통과
```

서버 실행 후 확인:

```bash
curl http://127.0.0.1:4100/health
# → {"success":true,"message":"OK"}

curl http://127.0.0.1:4100/nope
# → {"success":false,"message":"요청하신 경로를 찾을 수 없습니다: /nope"}
```

## 14. 완료 체크리스트

- [x] `backend/` Express 프로젝트 생성 (T010)
- [x] `app.ts`/`server.ts` 분리, cors/json 미들웨어 적용 (T011)
- [x] `routes/controllers/services/middlewares/schemas/lib` 폴더 구조 (T012)
- [x] nodemon + ts-node 개발 서버 (T013)
- [x] Helmet 보안 헤더 (T013-S)
- [x] 전역 Rate Limiting (T013-S2)
- [x] 전역 에러 핸들러, 스택 트레이스 미노출 (T013-S3)
- [x] Winston 로거 — 콘솔 + 파일 저장 (T013-S4)
- [x] CORS 허용 출처 명시적 제한 (T013-S5)
- [x] (선반영) 서버 시작 시 필수 환경변수 검증 (T020-S3)

## 15. 다음 단계

→ Phase 0-4 데이터베이스 세팅 (PostgreSQL + Prisma)
