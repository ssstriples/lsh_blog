# Phase 2: 회원 인증 시스템 (T028-S~T038)

> 관련 태스크: `T028-S`~`T028-S5`, `T029`~`T035-S3`, `T036`~`T038`
> 작업일: 2026-08-07
> 결과물 위치: `backend/src/{schemas,services,controllers,routes,lib,middlewares}`

## 1. 목표

2차 개정된 요구사항("관리자만 로그인" → "누구나 회원가입 후 로그인")에 맞춰
회원가입/로그인/토큰 재발급/로그아웃 API와, 이후 게시글 CRUD에서 재사용할
인증(Authentication)/인가(Authorization) 미들웨어를 구현한다.

---

## 2. 설치한 패키지

```bash
pnpm add bcryptjs jsonwebtoken zod cookie-parser
pnpm add -D @types/bcryptjs @types/jsonwebtoken @types/cookie-parser
```

| 패키지 | 역할 |
|---|---|
| `bcryptjs` | 비밀번호 해싱 (순수 JS 구현이라 네이티브 빌드 도구 불필요, Windows에서 편리) |
| `jsonwebtoken` | Access/Refresh Token 발급 및 검증 |
| `zod` | 요청 바디(회원가입/로그인 입력) 스키마 검증 |
| `cookie-parser` | Refresh Token을 담은 HttpOnly 쿠키를 읽기 위함 |

---

## 3. 아키텍처: 왜 Access Token + Refresh Token 두 개를 쓰는가

- **Access Token(15분)**: 매 API 요청마다 `Authorization: Bearer <token>` 헤더로 전달.
  수명이 짧아 탈취되어도 피해 범위가 제한적이다. 클라이언트 메모리(또는 상태 관리 스토어)에만 보관하고
  `localStorage`에는 저장하지 않는다 (XSS로 탈취될 위험 때문).
- **Refresh Token(7일)**: **HttpOnly + Secure + SameSite=Strict 쿠키**로만 저장되어
  JavaScript에서 절대 접근할 수 없다. Access Token이 만료되면 `/api/auth/refresh`를
  호출해 새 Access Token을 재발급받는다.

```ts
// backend/src/lib/jwt.ts (핵심 발췌)
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, { expiresIn: "15m" });
}
export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, { expiresIn: "7d" });
}
```

쿠키의 `path`를 `/api/auth/refresh`로 한정한 이유: 다른 API 요청에는 이 쿠키가 자동으로
딸려가지 않게 하여 노출 범위를 최소화한다.

```ts
const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth/refresh",
  maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS, // 7일
};
```

---

## 4. T028-S~S5 — 회원가입 API

`backend/src/schemas/authSchema.ts`에 Zod로 입력 검증 스키마를 만들고,
`authService.ts`에서 실제 가입 로직을 처리한다.

```ts
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .regex(/[a-zA-Z]/)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/), // 영문+숫자+특수문자 각 1개 이상
  name: z.string().trim().min(2).max(20),
});
```

이메일 중복 체크 → 있으면 409, 없으면 `bcrypt.hash(password, 12)`로 해싱 후 저장.
`role`, `status` 필드는 클라이언트가 임의로 지정하지 못하도록 **요청 바디에서 아예
읽지 않고 Prisma 스키마의 기본값(`USER`, `ACTIVE`)만 사용**한다.

회원가입 남용(대량 계정 생성) 방지를 위해 `signupRateLimiter`(1시간당 5회)를
라우트에 적용했다.

---

## 5. T029~T035-S3 — 로그인 API

### 이메일 열거(Enumeration) 공격 방지

"해당 이메일이 존재하지 않습니다"와 "비밀번호가 틀렸습니다"를 서로 다른 메시지로
응답하면, 공격자가 이메일 목록을 대입해보며 어떤 이메일이 가입되어 있는지
추측할 수 있습니다(계정 존재 여부 유출). 그래서 두 경우 모두 동일한 메시지
(`"이메일 또는 비밀번호가 올바르지 않습니다."`)와 401 상태코드로 응답합니다.

또한 이메일이 아예 존재하지 않는 경우에도, 존재하는 경우와 비슷한 처리 시간을
만들기 위해 **더미 해시값에 대해 `bcrypt.compare`를 한 번 실행**하고 나서
실패 처리를 합니다 (타이밍 공격 완화).

```ts
if (!user || !user.password) {
  await bcrypt.compare(input.password, "$2b$12$invalidsaltinvalidsaltinvalidsalte");
  genericInvalidCredentials();
  return;
}
```

### 계정 정지(SUSPENDED) 체크

```ts
if (user.status === "SUSPENDED") {
  throw new AppError("이용이 정지된 계정입니다. 문의사항은 관리자에게 연락해주세요.", 403);
}
```

### 로그인 Rate Limiting

`loginRateLimiter`(15분당 5회)를 적용하되, `skipSuccessfulRequests: true`로
설정해 **로그인에 성공한 요청은 카운트에서 제외**했다. 이렇게 하면 정상 사용자가
반복 로그인해도 제한에 걸리지 않고, 실패한 시도(무차별 대입 공격)만 카운트된다.

### 보안 로그 기록

`winston` 로거로 로그인 성공/실패, 정지 계정 로그인 시도를 모두 기록한다
(`logger.info`, `logger.warn`).

---

## 6. T036~T037 — 인증/인가 미들웨어

`backend/src/middlewares/authMiddleware.ts`에 3가지 미들웨어를 작성했다.

| 미들웨어 | 역할 |
|---|---|
| `requireAuth` | `Authorization: Bearer` 헤더 검증, 실패 시 401. 성공 시 `req.user = { id, role }` 채움 |
| `optionalAuth` | 토큰이 있으면 검증해서 `req.user`를 채우고, 없거나 유효하지 않아도 그냥 통과 (게스트 허용 라우트용) |
| `requireAdmin` | `req.user.role === 'ADMIN'`이 아니면 403. `requireAuth` 이후에 사용 |

`req.user`에 타입 안전하게 접근하기 위해 Express의 `Request` 타입을 다음과 같이
전역 확장(declaration merging)했다:

```ts
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
```

> ✅ **T037-S(소유권 검증 미들웨어)는 Phase 3(게시글 CRUD) 구현 시 함께 작성 예정**이다.
> 소유권 검증은 "게시글의 `authorId`"처럼 리소스마다 다른 필드/조회 방식이 필요해서,
> 게시글 라우트를 만들 때 함께 설계하는 것이 더 자연스럽기 때문이다.

---

## 7. T038 — 통합 테스트 (curl)

서버를 백그라운드로 띄운 뒤 curl로 전체 플로우를 검증했다.

```bash
# 1. 회원가입
curl -X POST http://127.0.0.1:4100/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"Test1234!","name":"테스터"}'
# → 201 { success: true, data: { id, email, name, role: "USER", createdAt } }

# 2. 로그인 (쿠키 저장)
curl -X POST http://127.0.0.1:4100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"Test1234!"}' \
  -c cookies.txt
# → 200 { success: true, data: { user, accessToken } }
# 응답 헤더에 Set-Cookie: refreshToken=...; HttpOnly; Path=/api/auth/refresh

# 3. 토큰 재발급
curl -X POST http://127.0.0.1:4100/api/auth/refresh -b cookies.txt
# → 200 { success: true, data: { accessToken } }

# 4. 로그아웃
curl -X POST http://127.0.0.1:4100/api/auth/logout -H "Authorization: Bearer <accessToken>"
# → 200 { success: true, message: "로그아웃되었습니다." }

# 5. 중복 이메일 재가입 시도
curl -X POST http://127.0.0.1:4100/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com", ...}'
# → 409 { success: false, message: "이미 사용 중인 이메일입니다." }
```

모든 케이스가 예상대로 동작함을 확인했다. 테스트 후 생성된 테스트 계정은 DB에서
삭제 처리했다.

---

## 8. 배운 점

- Refresh Token 쿠키의 `path`를 좁게 제한하면, 다른 API 요청에 불필요하게 민감한
  쿠키가 딸려가는 것을 막을 수 있다.
- 로그인 실패 메시지는 "이메일 없음"과 "비밀번호 틀림"을 구분하지 않는 것이
  보안 모범 사례다 (계정 존재 여부를 공격자에게 알려주지 않기 위함).
- Rate Limiter의 `skipSuccessfulRequests` 옵션으로 "성공한 요청은 카운트 제외" 처리하면
  정상 사용자 경험을 해치지 않으면서 무차별 대입 공격만 효과적으로 막을 수 있다.
- Express `Request` 타입에 `req.user`를 추가할 때는 `declare global { namespace Express { ... } }`
  패턴으로 타입을 전역 확장한다.
