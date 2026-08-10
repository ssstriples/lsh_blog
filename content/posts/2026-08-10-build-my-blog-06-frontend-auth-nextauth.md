---
title: "기술 블로그를 직접 만들어보자 #6 — NextAuth로 로그인 화면 붙이기 (feat. 프론트-백엔드 인증 연결)"
slug: "build-my-blog-06-frontend-auth-nextauth"
date: "2026-08-10"
category: "프로젝트 회고"
tags: ["프론트엔드", "Next.js", "NextAuth", "인증", "미들웨어"]
status: "DRAFT"
summary: "백엔드에 만들어둔 로그인 API를 실제 화면에서 쓸 수 있게 NextAuth로 연결했습니다. 서버끼리 통신할 때 쿠키를 못 주고받는 문제, accessToken 자동 갱신, 로그인 안 한 사람 막아내는 방법까지 정리합니다."
---

# 기술 블로그를 직접 만들어보자 #6 — NextAuth로 로그인 화면 붙이기

> [4편](./2026-08-07-build-my-blog-04-jwt-auth-signup-login.md)에서 회원가입/로그인
> **API**를 만들었었죠. 그런데 API만 있고 실제로 로그인 버튼을 누를 화면이 없다면
> 아무 소용이 없습니다. 이번 편에서는 만들어둔 API를 실제 로그인/회원가입 화면과
> 연결하고, 로그인 여부에 따라 화면이 바뀌게 만들어보겠습니다.

## 이 글에서 다루는 내용

1. NextAuth가 뭐고 왜 쓰나요?
2. "서버가 서버를 호출할 때"는 브라우저 쿠키를 못 쓴다는 문제
3. 로그인 안 하면 막는 방법 (라우트 보호)
4. 실제로 테스트해보기

---

## 1. NextAuth가 뭐고 왜 쓰나요?

로그인 기능을 직접 처음부터 만들려면 신경 쓸 게 많습니다. 로그인 상태를
어디에 저장할지, 브라우저를 새로고침해도 로그인이 풀리지 않게 하려면
어떻게 해야 할지, 토큰이 만료되면 자동으로 갱신하는 로직은 어떻게 짤지 등등요.

> **NextAuth(Auth.js)**란, Next.js 프로젝트에서 로그인 상태 관리를 대신 해주는
> 라이브러리입니다. "로그인된 사용자 정보를 어디에 저장하고 꺼내 쓸지"를
> 표준화해줍니다.

이 프로젝트는 이미 4편에서 회원가입/로그인 **API**(백엔드)를 다 만들어뒀기
때문에, NextAuth의 로그인 화면 자체를 새로 만드는 게 아니라 **"기존 API를
호출해서 그 결과를 NextAuth의 로그인 상태로 등록하는"** 방식으로 연결했습니다.

```ts
// frontend/src/lib/auth.ts
Credentials({
  async authorize(credentials) {
    // 우리가 4편에서 만든 백엔드 로그인 API를 그대로 호출
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    return { ...res.user, accessToken: res.accessToken, refreshToken: res.refreshToken };
  },
})
```

---

## 2. 서버가 서버를 호출할 때는 쿠키를 못 받는다?

여기서 좀 헷갈릴 수 있는 부분이 나옵니다. 원래 백엔드의 로그인 API는
**"브라우저가 직접 호출한다"**고 가정하고 만들어져 있었습니다. 그래서 로그인에
성공하면 `refreshToken`을 브라우저의 쿠키 저장소에 자동으로 넣어주는
`Set-Cookie` 헤더를 응답에 실어서 보냅니다.

그런데 NextAuth의 `authorize()` 함수는 브라우저가 아니라 **Next.js 서버 자신이**
백엔드 API를 호출하는 겁니다. 브라우저를 거치지 않으니 `Set-Cookie`를 받아도
저장할 곳이 없습니다 (서버는 쿠키 저장소가 없으니까요).

> 비유하자면, 원래는 손님(브라우저)이 직접 가게(백엔드)에 가서 쿠폰(쿠키)을
> 받아오는 구조였는데, 지금은 배달원(Next.js 서버)이 대신 가게에 다녀오는
> 상황입니다. 배달원이 쿠폰을 받아도 그건 배달원 손에 있을 뿐, 손님 지갑에
> 들어가진 않죠.

그래서 백엔드 API를 살짝 고쳐서, `refreshToken`을 쿠키뿐 아니라 **응답 데이터
안에도 그대로 넣어서** 돌려주도록 했습니다.

```ts
// backend/src/controllers/authController.ts
res.json({
  success: true,
  data: { user, accessToken, refreshToken }, // refreshToken을 데이터로도 반환
});
```

이렇게 하면 NextAuth가 이 `refreshToken`을 받아서, **자기가 관리하는 암호화된
세션(로그인 정보)** 안에 잘 보관해뒀다가, 나중에 `accessToken`이 만료됐을 때
알아서 갱신 요청을 보낼 때 사용합니다.

---

## 3. 로그인 안 하면 막는 방법 — 라우트 보호

`/my/*`(마이페이지)는 로그인한 사람만, `/admin/*`(관리자 페이지)는 관리자만
들어갈 수 있어야 합니다. Next.js에서는 이런 "페이지 접근 전에 먼저 체크하는
로직"을 파일 하나로 만들 수 있습니다.

```ts
// frontend/src/proxy.ts
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith("/my") && !session?.user) {
    return NextResponse.redirect(new URL("/login?callbackUrl=" + pathname, req.url));
  }
  if (pathname.startsWith("/admin")) {
    if (!session?.user) return NextResponse.redirect(new URL("/login", req.url));
    if (session.user.role !== "ADMIN") return NextResponse.redirect(new URL("/403", req.url));
  }
});
```

> 여기서 재밌는 뒷이야기가 하나 있는데, 이 파일의 이름은 원래
> `middleware.ts`였습니다. 그런데 최근 버전의 Next.js(16)에서 "middleware라는
> 이름이 다른 프레임워크의 미들웨어 개념과 헷갈린다"는 이유로 파일 이름을
> `proxy.ts`로 바꾸라는 안내가 나왔습니다. 하는 일은 완전히 똑같고, 이름만
> 바뀐 거라서 그냥 파일명을 바꿔줬습니다.

---

## 4. 실제로 테스트해보기

화면을 눈으로 보기 전에, 터미널에서 curl로 전체 흐름을 먼저 검증해봤습니다.

```bash
# 1. 회원가입
POST /api/auth/signup → 성공

# 2. 로그인 (NextAuth를 통해서)
POST /api/auth/callback/credentials → 로그인 성공, 세션 쿠키 발급됨

# 3. 로그인 상태 확인
GET /api/auth/session → { user: {...}, accessToken: "..." }

# 4. 로그인 안 한 상태로 마이페이지 접근
GET /my/posts → /login?callbackUrl=/my/posts 로 리다이렉트됨 ✅

# 5. 일반 회원이 관리자 페이지 접근
GET /admin → /403 페이지로 리다이렉트됨 ✅

# 6. 로그아웃
POST /api/auth/signout → 세션 쿠키 삭제됨 ✅
```

모든 시나리오가 의도한 대로 동작했습니다.

---

## 다음 편 예고

로그인/회원가입 화면까지 연결했으니, 다음 편에서는 실제로 **게시글 목록/상세
페이지, 글쓰기 에디터**를 프론트엔드에 붙여볼 예정입니다.
