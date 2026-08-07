---
title: "기술 블로그를 직접 만들어보자 #2 — Express 서버에 보안 미들웨어 5종 세트 붙이기"
slug: "build-my-blog-02-express-backend-security-middlewares"
date: "2026-08-07"
category: "프로젝트 회고"
tags: ["Express", "TypeScript", "보안", "백엔드", "Node.js"]
status: "DRAFT"
summary: "Express + TypeScript로 백엔드 서버를 처음 만들면서, 실무에서 꼭 필요한 5가지 보안/운영 미들웨어(Helmet, Rate Limiting, 에러 핸들러, 로거, CORS)를 하나씩 붙여본 과정을 기록합니다."
---

# 기술 블로그를 직접 만들어보자 #2 — Express 서버에 보안 미들웨어 5종 세트 붙이기

> [1편](./2026-08-07-build-my-blog-01-dev-environment-nextjs-setup.md)에서는 프론트엔드(Next.js)를 세팅했다면,
> 이번 2편에서는 데이터를 처리해줄 **백엔드 서버(Express)**를 만들고
> 보안을 위한 필수 미들웨어들을 하나씩 붙여보겠습니다.

## 이 글에서 다루는 내용

1. Express 프로젝트 처음부터 만들기
2. `app.ts`와 `server.ts`를 왜 파일로 분리하는지
3. 실무 필수 보안 미들웨어 5가지
   - Helmet (보안 헤더)
   - Rate Limiting (요청 횟수 제한)
   - 전역 에러 핸들러
   - Winston 로거
   - CORS 출처 제한
4. TypeScript 버전 충돌 삽질기

---

## 1. 왜 백엔드 서버가 따로 필요한가요?

Next.js 자체에도 API를 만들 수 있는 기능(Route Handler)이 있지만,
이 프로젝트에서는 **Express로 별도의 백엔드 서버**를 두기로 했습니다.
이렇게 하면 프론트엔드(화면)와 백엔드(데이터 처리)가 완전히 분리되어,
나중에 모바일 앱을 추가로 만들 때도 같은 백엔드 API를 재사용할 수 있습니다.

---

## 2. Express 프로젝트 시작하기

```bash
mkdir backend && cd backend
pnpm init
```

그다음 필요한 패키지들을 설치합니다.

```bash
# 서버가 실제로 동작하는 데 필요한 패키지
pnpm add express cors dotenv helmet express-rate-limit winston

# 개발할 때만 필요한 패키지 (TypeScript 실행/빌드)
pnpm add -D typescript ts-node ts-node-dev nodemon tsconfig-paths \
  @types/node @types/express @types/cors
```

### 이 패키지들이 하는 일 (한눈에 보기)

| 패키지 | 한 줄 설명 |
|---|---|
| `express` | 요청을 받아서 응답을 보내주는 웹 서버의 뼈대 |
| `cors` | "어떤 웹사이트에서 온 요청만 받아줄지" 정하는 문지기 |
| `dotenv` | `.env` 파일의 비밀 값들을 코드에서 쓸 수 있게 불러옴 |
| `helmet` | 보안에 좋은 HTTP 헤더를 자동으로 세팅해주는 도구 |
| `express-rate-limit` | 짧은 시간에 너무 많이 요청하면 막아주는 도구 |
| `winston` | `console.log`보다 똑똑한 로그 기록 도구 |

---

## 3. `app.ts`와 `server.ts`, 왜 나눴을까?

처음엔 파일 하나에 다 몰아넣어도 될 것 같지만, 실무에서는 보통 이렇게 나눕니다.

- **`app.ts`**: Express 앱을 "조립"만 하는 파일 (미들웨어 등록, 라우트 연결)
- **`server.ts`**: 그 앱을 실제로 **실행**시키는 파일 (`app.listen()` 호출)

> 💡 이렇게 나누면, 나중에 테스트 코드를 작성할 때 `server.ts`를 거치지 않고
> `app.ts`만 가져와서 "가짜 요청"을 보내는 테스트를 만들 수 있습니다.
> (실제 포트를 열지 않고도 로직을 검증할 수 있어요!)

```ts
// app.ts — 앱 조립
export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(globalRateLimiter);
  app.use(express.json());
  // ... 라우트 등록
  app.use(errorHandler); // 항상 제일 마지막!
  return app;
}
```

```ts
// server.ts — 앱 실행
const app = createApp();
app.listen(4100, () => console.log("서버 실행 중!"));
```

---

## 4. 보안 미들웨어 5종 세트

### 4-1. Helmet — 보안 헤더 자동 설정

```ts
app.use(helmet());
```

이 한 줄만 추가하면, 브라우저가 내 사이트를 더 안전하게 다루도록
여러 HTTP 헤더를 자동으로 설정해줍니다. 예를 들어:

- 다른 사이트가 내 페이지를 몰래 `<iframe>`에 넣어서 클릭을 속이는 공격(클릭재킹) 방지
- 브라우저가 파일 형식을 마음대로 추측해서 위험한 코드를 실행하는 것 방지

직접 이런 헤더들을 하나하나 공부해서 설정하는 건 어려운 일이라,
**검증된 라이브러리를 쓰는 것이 훨씬 안전**합니다.

### 4-2. Rate Limiting — "너무 많이 요청하지 마세요"

```ts
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  limit: 100,               // 최대 100번
  message: { success: false, message: "너무 많은 요청을 보냈습니다." },
});
```

같은 IP 주소에서 15분 동안 100번 넘게 요청을 보내면, 서버가
"429 Too Many Requests"라는 응답과 함께 요청을 거절합니다.

> 💡 왜 필요한가요? 로그인 화면에서 비밀번호를 수천 번 무작위로 시도하는
> 공격(Brute-force)이나, 서버를 마비시키려는 공격(DDoS)을 막아줍니다.

### 4-3. 전역 에러 핸들러 — 에러가 나도 서버 내부를 숨기기

코드를 짜다 보면 예상치 못한 에러가 발생할 수 있습니다. 이때 에러 내용을
그대로 사용자에게 보여주면, 서버 내부 구조(파일 경로, 사용 라이브러리 등)가
그대로 노출되어 공격자에게 힌트를 줄 수 있습니다.

```ts
export function errorHandler(err, req, res, next) {
  // 에러의 자세한 내용은 서버 로그에만 기록
  logger.error(err.message, { stack: err.stack });

  // 사용자에게는 안전한 메시지만 전달
  res.status(500).json({ success: false, message: "서버 내부 오류가 발생했습니다." });
}
```

이렇게 "의도된 에러"(예: 404 Not Found)와 "예상치 못한 버그"를 구분해서,
전자는 구체적인 메시지를, 후자는 뭉뚱그린 메시지를 보여주도록 만들었습니다.

### 4-4. Winston — 똑똑한 로그 기록

```ts
export const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),                              // 화면에 출력
    new winston.transports.File({ filename: "logs/error.log" }),   // 에러만 별도 저장
    new winston.transports.File({ filename: "logs/combined.log" }), // 전체 로그 저장
  ],
});
```

`console.log`만으로는 "언제, 어떤 심각도로, 어떤 내용의 로그인지"를
체계적으로 관리하기 어렵습니다. `winston`을 쓰면 로그를 파일에 자동 저장해서
나중에 문제가 생겼을 때 원인을 추적하기 쉬워집니다.

### 4-5. CORS — "이 도메인만 내 API를 쓸 수 있어요"

```ts
const allowedOrigins = ["http://localhost:3000"];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); // 허용
    } else {
      callback(new Error("CORS 정책에 의해 차단됨")); // 거절
    }
  },
  credentials: true,
}));
```

> 💡 CORS가 뭔가요? 브라우저는 기본적으로 "내가 접속한 사이트와 다른 도메인의 API"를
> 호출하는 것을 막습니다 (보안 목적). 서버 쪽에서 "이 도메인은 믿을 수 있으니 허용해줘"라고
> 명시적으로 알려주는 것이 CORS 설정입니다. 아무 도메인이나 다 허용(`*`)해버리면
> 악성 사이트도 내 API를 자유롭게 호출할 수 있게 되어 위험합니다.

---

## 5. 🔥 삽질 포인트: TypeScript 버전 충돌

`typescript`를 설치했더니 최신 버전인 **7.0.2**가 깔렸는데,
`ts-node`로 서버를 실행하려니 이런 에러가 났습니다.

```
TypeError: Cannot read properties of undefined (reading 'fileExists')
```

### 원인을 파헤쳐 보니

`ts-node`(TypeScript 코드를 컴파일 없이 즉시 실행해주는 도구)의 최신 안정 버전(10.9.2)이
아직 TypeScript 7의 내부 구조 변경에 맞춰 업데이트되지 않았던 것이었습니다.
즉, **두 라이브러리의 "최신 버전끼리" 서로 호환이 안 되는 상황**이었죠.

### 해결 방법

TypeScript를 조금 더 안정적으로 검증된 **5.9.3** 버전으로 낮췄습니다.

```bash
pnpm add -D typescript@5.9.3
```

> 💡 **배운 점**: "최신 버전 = 항상 좋은 것"은 아닙니다. 여러 라이브러리를 함께 쓸 때는
> 서로 호환되는 조합을 찾는 것이 중요합니다. 에러 메시지에 나온 파일 경로(`ts-node/dist/...`)를
> 따라가 보면 어느 라이브러리에서 문제가 생겼는지 힌트를 얻을 수 있어요.

---

## 6. 서버가 잘 도는지 확인하기

```bash
pnpm run build   # TypeScript → JavaScript 변환이 잘 되는지 확인
pnpm run dev      # 개발 서버 실행 (저장할 때마다 자동 재시작)
```

브라우저나 터미널에서 헬스체크 API를 호출해봅니다.

```bash
curl http://127.0.0.1:4100/health
# → {"success":true,"message":"OK"}
```

존재하지 않는 경로를 호출하면 우리가 만든 404 핸들러가 잘 동작하는지도 확인합니다.

```bash
curl http://127.0.0.1:4100/nope
# → {"success":false,"message":"요청하신 경로를 찾을 수 없습니다: /nope"}
```

둘 다 정상적으로 응답이 오면 성공입니다! 🎉

---

## 7. 마무리

이번 편에서는 Express 서버의 뼈대를 세우고, 보안을 위한 5가지 미들웨어를
차근차근 붙여봤습니다. 특히 "왜 이 미들웨어가 필요한지"를 이해하는 게
단순히 코드를 복사-붙여넣기 하는 것보다 훨씬 중요하다고 느꼈습니다.

## 다음 편 예고

다음 글에서는 **PostgreSQL과 Prisma**를 연결해서, 실제로 데이터베이스에
데이터를 저장하고 불러오는 과정을 다뤄보겠습니다.

> 이 시리즈의 모든 코드는 [GitHub 저장소](https://github.com/ssstriples/lsh_blog)에서 확인할 수 있습니다.
