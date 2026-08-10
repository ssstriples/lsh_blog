# Phase 2-3: 로그인/회원가입 화면 + NextAuth (Frontend) (T039~T044)

> 관련 태스크: `T039`~`T044`, `T040-S`
> 작업일: 2026-08-10
> 결과물 위치: `frontend/src/{lib/auth.ts,types/auth.ts,types/next-auth.d.ts,app/api/auth,app/login,app/signup,app/403,components/layout,proxy.ts}`

## 1. 목표

Phase 2에서 백엔드에 이미 만들어둔 JWT 인증 시스템(access 15분 / refresh 7일 쿠키)을
**프론트엔드에서 실제로 사용할 수 있게** NextAuth v5(Auth.js)로 감싸고, 로그인/회원가입
화면, 헤더의 로그인 상태 표시, 로그아웃, `/my/*`·`/admin/*` 경로 접근 제어까지 구현한다.

이 작업은 Phase 3(게시글 CRUD 백엔드)이 먼저 끝난 뒤에야 놓친 것을 발견해서 뒤늦게
채워 넣은 태스크다. 백엔드 인증 API는 이미 완성되어 있었으므로, 이번 작업의 핵심은
"이미 있는 백엔드 API를 프론트엔드 세션 시스템에 어떻게 연결하는가"였다.

---

## 2. 설치한 패키지

```bash
pnpm add next-auth@beta
```

NextAuth v5(베타)는 App Router와 Route Handler(`app/api/auth/[...nextauth]/route.ts`)를
기본으로 지원하고, `auth()` 헬퍼 하나로 서버 컴포넌트/미들웨어/API 라우트에서 모두
세션을 조회할 수 있어 App Router 프로젝트에 적합하다.

---

## 3. 핵심 설계: NextAuth가 백엔드 REST API를 감싸는 구조

이 프로젝트는 NextAuth의 기본 DB 어댑터를 쓰지 않는다. 대신 **Credentials Provider가
매 로그인 시도마다 기존 백엔드 `/api/auth/login`을 호출**하고, 백엔드가 발급한
JWT를 NextAuth의 자체 세션(JWT 전략)에 그대로 보관하는 구조로 만들었다.

```ts
// frontend/src/lib/auth.ts
Credentials({
  async authorize(credentials) {
    const res = await apiFetch<LoginResponseData>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    // 실패 시 ApiError를 throw → NextAuth가 signIn() 결과의 error로 넘겨줌
    return { ...res.user, accessToken: res.accessToken, refreshToken: res.refreshToken };
  },
})
```

### 3-1. refreshToken을 왜 JSON 바디로도 받는가?

백엔드의 기존 로그인 흐름은 브라우저가 직접 호출한다고 가정하고 `refreshToken`을
HttpOnly 쿠키로 `Set-Cookie` 해준다. 그런데 NextAuth의 `authorize()`는 **서버(Node.js)에서
백엔드로 보내는 서버-서버 요청**이라, 브라우저가 아니므로 이 `Set-Cookie`를 받아 저장할
방법이 없다. 그래서 백엔드 `login()`을 다음처럼 살짝 수정했다.

```ts
// backend/src/controllers/authController.ts
res.status(200).json({
  success: true,
  // refreshToken을 JSON 바디에도 함께 반환하는 이유: NextAuth의 authorize()는
  // 서버 사이드에서 이 API를 호출하므로 브라우저가 Set-Cookie를 받지 못한다.
  // NextAuth가 자체 암호화된 세션(JWT)에 refreshToken을 보관하고, 갱신 시 Cookie 헤더로
  // 재구성해 보낸다.
  data: { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken },
});
```

NextAuth는 이 `refreshToken`을 자신의 암호화된 세션 쿠키(`authjs.session-token`) 안에
넣어 보관한다. 브라우저 쪽 쿠키 저장소에는 노출되지 않고, 서버에서만 복호화해서 쓴다.

### 3-2. accessToken 자동 갱신 (jwt 콜백)

```ts
async jwt({ token, user }) {
  if (user) {
    // 최초 로그인 시점: accessToken 만료 시각을 15분 뒤로 계산해 저장
    return { ...token, accessToken: user.accessToken, refreshToken: user.refreshToken,
      accessTokenExpires: Date.now() + 15 * 60 * 1000, user };
  }
  if (Date.now() < token.accessTokenExpires) return token; // 아직 안 만료됨
  return refreshAccessToken(token); // 만료됨 → 갱신 시도
}
```

`refreshAccessToken()`은 백엔드의 `/api/auth/refresh`를 호출하는데, 이때도 마찬가지로
브라우저 쿠키가 없으므로 `Cookie: refreshToken=...` 헤더를 **직접 문자열로 재구성해서**
보낸다. 실패하면 `token.error = "RefreshAccessTokenError"`를 세팅해 세션 쪽에서
재로그인을 유도할 수 있게 했다.

### 3-3. 타입 확장 (module augmentation)

NextAuth의 기본 `Session`/`User`/`JWT` 타입에는 우리가 쓰는 `accessToken`, `role` 같은
필드가 없어서, `next-auth.d.ts`에서 모듈을 확장했다.

```ts
declare module "next-auth" {
  interface User extends AuthUser {
    accessToken?: string;
    refreshToken?: string;
  }
  interface Session {
    user: AuthUser;
    accessToken: string;
    error?: string;
  }
}
```

주의: `interface User extends AuthUser {}`처럼 멤버 없이 확장만 하면 TS가 "상위 타입과
동일한 인터페이스"라는 경고를 낸다. `accessToken`/`refreshToken` 같은 실제로 쓰는
필드를 명시적으로 추가해야 경고 없이 의도가 분명해진다.

또한 `session()` 콜백에서는 `session.user = token.user`처럼 **기존 객체를 직접
mutate하면** `AdapterUser & User` 타입과 충돌해 컴파일 에러가 난다. 새 객체를
`{ ...session, user, accessToken, error }` 형태로 반환하는 방식으로 해결했다.

---

## 4. 라우트 보호: `/my/*`, `/admin/*`

```ts
// frontend/src/proxy.ts
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith("/my") && !session?.user) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin")) {
    if (!session?.user) { /* 위와 동일하게 /login으로 */ }
    if (session.user.role !== "ADMIN") return NextResponse.redirect(new URL("/403", req.nextUrl.origin));
  }
  return NextResponse.next();
});

export const config = { matcher: ["/my/:path*", "/admin/:path*"] };
```

### Next.js 16의 `middleware.ts` → `proxy.ts` 파일 컨벤션 변경

빌드 중 다음 경고를 만났다.

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

Next.js 16부터 "middleware"라는 이름이 Express 미들웨어와 혼동을 준다는 이유로
파일 컨벤션 이름이 `proxy.ts`로 바뀌었다 (export하는 함수 시그니처와 동작은 동일,
단지 파일명과 관례적인 함수명만 바뀜). 공식 codemod(`npx @next/codemod@canary
middleware-to-proxy .`)를 시도했으나 비대화형 환경에서 인터럽트(exit code 130)되어
파일을 생성하지 못했다. 결국 `git mv middleware.ts proxy.ts`로 수동 처리했고,
재빌드 후 경고가 사라짐을 확인했다.

---

## 5. UI 컴포넌트에서 겪은 `asChild` vs `render` 이슈

이 프로젝트의 shadcn/ui는 Radix UI가 아니라 **Base UI** 기반으로 세팅되어 있다.
Radix 스타일의 `<Button asChild><Link href="...">...</Link></Button>` 패턴을 그대로
쓰면 `asChild` prop이 존재하지 않아 컴파일 에러가 난다. 기존 `ThemeToggle` 컴포넌트가
이미 쓰고 있던 패턴을 참고해 `render` prop으로 통일했다.

```tsx
<Button render={<Link href="/login">로그인</Link>} />
```

---

## 6. 기능 테스트 (curl 기반)

프론트엔드 dev 서버(`localhost:3000`)와 백엔드 dev 서버(`localhost:4100`)를 함께 띄운 뒤,
NextAuth의 CSRF 토큰 발급 → 로그인 → 세션 조회 → 라우트 보호 → 로그아웃까지 curl로
직접 검증했다.

```bash
# 1. 회원가입 (백엔드 직접 호출)
POST http://localhost:4100/api/auth/signup → 201

# 2. CSRF 토큰 발급
GET http://localhost:3000/api/auth/csrf → { csrfToken }

# 3. NextAuth 로그인 (credentials)
POST http://localhost:3000/api/auth/callback/credentials
  (email, password, csrfToken) → 302 + Set-Cookie: authjs.session-token=...

# 4. 세션 확인
GET http://localhost:3000/api/auth/session (쿠키 포함)
  → { user: { id, email, name, role }, accessToken, expires }

# 5. 비로그인 상태로 /my/posts 접근 → 307 리다이렉트 /login?callbackUrl=%2Fmy%2Fposts
# 6. 로그인 상태(비관리자)로 /admin 접근 → 307 리다이렉트 /403
# 7. 로그아웃 (signout) → Set-Cookie: authjs.session-token=; Max-Age=0
# 8. 로그아웃 후 세션 재조회 → 빈 응답 (세션 없음)
```

모든 케이스가 예상대로 동작함을 확인했다.

---

## 7. 배운 점

- 프론트엔드 인증 라이브러리(NextAuth)가 자체 DB/어댑터를 쓰지 않고 **기존 REST
  백엔드를 감싸는 얇은 레이어**로만 동작하게 만들 수 있다. 이 경우 서버-서버 호출은
  브라우저 쿠키를 주고받지 못한다는 점을 반드시 고려해서, 필요한 토큰을 응답 바디에도
  함께 실어주거나 헤더를 수동으로 재구성해야 한다.
- NextAuth의 타입 확장(module augmentation)에서는 "빈 확장"을 피하고, `session()`
  콜백에서는 기존 객체를 mutate하지 말고 새 객체를 반환하는 것이 TS 타입 충돌을
  피하는 가장 안전한 방법이다.
- 메이저 버전 업그레이드(Next.js 16)는 파일 컨벤션 이름까지 조용히 바꿀 수 있다.
  빌드 경고를 무시하지 않고 즉시 대응하는 습관이 필요하다.
- UI 라이브러리가 Radix인지 Base UI인지에 따라 `asChild`/`render` 같은 API 표면이
  달라지므로, 새 컴포넌트를 작성하기 전에 프로젝트에 이미 있는 유사 컴포넌트의
  패턴을 먼저 확인하는 것이 안전하다.
