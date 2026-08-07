---
title: "기술 블로그를 직접 만들어보자 #4 — 회원가입/로그인 API와 JWT 인증 만들기"
slug: "build-my-blog-04-jwt-auth-signup-login"
date: "2026-08-07"
category: "프로젝트 회고"
tags: ["JWT", "인증", "보안", "백엔드", "Express"]
status: "DRAFT"
summary: "회원가입, 로그인, 토큰 재발급, 로그아웃까지 — JWT 기반 인증 시스템을 처음부터 만들어보며 왜 토큰을 두 개(Access/Refresh)로 나누는지, 비밀번호는 어떻게 안전하게 저장하는지 초보자 눈높이에서 정리했습니다."
---

# 기술 블로그를 직접 만들어보자 #4 — 회원가입/로그인 API와 JWT 인증 만들기

> [3편](./2026-08-07-build-my-blog-03-postgresql-prisma-setup.md)에서 데이터베이스를 연결했다면,
> 이번 4편에서는 그 데이터베이스에 회원 정보를 저장하고, 로그인 상태를 유지하는
> **인증(Authentication) 시스템**을 만들어보겠습니다.

## 이 글에서 다루는 내용

1. 비밀번호를 데이터베이스에 그대로 저장하면 안 되는 이유
2. JWT(JSON Web Token)가 뭔가요?
3. 왜 토큰을 Access/Refresh 두 개로 나누나요?
4. 로그인 실패 메시지는 왜 애매하게 만들어야 하나요?
5. 실제로 API 테스트해보기

---

## 1. 비밀번호, 그대로 저장하면 큰일 납니다

회원가입할 때 사용자가 입력한 비밀번호를 데이터베이스에 문자 그대로 저장하면,
만약 데이터베이스가 해킹당했을 때 모든 사용자의 비밀번호가 그대로 유출됩니다.
그래서 비밀번호는 **해싱(hashing)**이라는 과정을 거쳐 저장합니다. 해싱은
"원래 값으로 되돌릴 수 없는 변환"이라고 생각하면 됩니다.

이 프로젝트는 `bcryptjs`라는 라이브러리를 사용합니다.

```ts
const hashedPassword = await bcrypt.hash(plainPassword, 12); // 12 = 해싱 강도(salt rounds)
```

로그인할 때는 사용자가 입력한 비밀번호를 다시 해싱하는 게 아니라,
`bcrypt.compare(입력값, 저장된해시값)`으로 **일치 여부만 비교**합니다.

---

## 2. JWT(JSON Web Token)란?

로그인에 성공하면 서버는 "이 사람은 로그인한 사용자입니다"라는 증명서를
발급해줘야 합니다. 이 증명서 역할을 하는 것이 **JWT**입니다.

JWT는 `사용자 ID`, `권한` 같은 정보를 담은 문자열인데, 서버만 아는 비밀 키로
서명(sign)이 되어 있어서 **위조가 불가능**합니다. 클라이언트는 로그인 후 이
토큰을 받아서, 이후 API 요청마다 헤더에 담아 보냅니다.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

서버는 이 토큰을 검증해서, 위조되지 않았고 만료되지 않았다면
"이 사용자는 로그인 상태구나"라고 판단합니다.

---

## 3. 왜 토큰을 2개(Access + Refresh)로 나눌까?

가장 간단한 방법은 토큰 하나를 오래(예: 7일) 유지하는 것이지만, 이 방법은
토큰이 탈취되었을 때 위험합니다 — 공격자가 7일 내내 그 사용자인 척 행세할 수
있기 때문입니다.

그래서 이 프로젝트는 두 종류의 토큰을 사용합니다.

| 토큰 | 수명 | 저장 위치 | 용도 |
|---|---|---|---|
| **Access Token** | 15분 | 클라이언트 메모리 | 매 API 요청마다 사용 |
| **Refresh Token** | 7일 | HttpOnly 쿠키 (JS로 접근 불가) | Access Token이 만료되면 재발급용 |

Access Token은 수명이 짧아서, 만약 탈취되더라도 15분만 지나면 무용지물이
됩니다. Refresh Token은 수명이 길지만, **HttpOnly 쿠키**라는 특수한 저장소에
저장되어 있어서 자바스크립트 코드(`document.cookie`)로는 절대 읽을 수 없습니다.
이 덕분에 만약 사이트에 악성 스크립트(XSS)가 삽입되어도 Refresh Token까지는
훔쳐갈 수 없습니다.

```ts
res.cookie("refreshToken", token, {
  httpOnly: true,       // JS로 접근 불가
  secure: true,          // HTTPS에서만 전송 (배포 환경)
  sameSite: "strict",    // 다른 사이트에서의 요청에는 쿠키 전송 안 함
  path: "/api/auth/refresh", // 이 경로로 요청할 때만 쿠키가 자동 전송됨
});
```

---

## 4. 로그인 실패 메시지는 왜 애매하게 만들어야 할까?

"해당 이메일로 가입된 계정이 없습니다"라고 정확히 알려주면 편리해 보이지만,
사실 보안에는 좋지 않습니다. 공격자가 이메일 목록을 하나씩 넣어보면서
"이 이메일은 가입되어 있구나"를 알아낼 수 있기 때문입니다 (이를 **이메일 열거
공격**이라고 합니다).

그래서 이 프로젝트는 "이메일이 없는 경우"와 "비밀번호가 틀린 경우" 모두
**똑같은 메시지**("이메일 또는 비밀번호가 올바르지 않습니다.")로 응답합니다.

심지어 이메일이 아예 존재하지 않을 때도, 마치 비밀번호를 검사하는 것처럼
일부러 시간이 걸리는 연산을 한 번 해줍니다. 그렇지 않으면 "이메일이 존재하는
경우 응답이 조금 더 오래 걸린다"는 미세한 시간 차이로도 정보가 유출될 수
있기 때문입니다 (**타이밍 공격**).

---

## 5. 실제로 테스트해보기

서버를 실행한 후, 터미널에서 curl로 직접 API를 호출해봤습니다.

```bash
# 회원가입
curl -X POST http://localhost:4100/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"Test1234!","name":"테스터"}'
```
```json
{ "success": true, "data": { "id": "...", "email": "test1@example.com", "name": "테스터", "role": "USER" } }
```

```bash
# 로그인
curl -X POST http://localhost:4100/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"Test1234!"}' \
  -c cookies.txt
```
```json
{ "success": true, "data": { "user": { ... }, "accessToken": "eyJ..." } }
```

같은 이메일로 다시 가입을 시도하면?

```bash
curl -X POST http://localhost:4100/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com", ...}'
```
```json
{ "success": false, "message": "이미 사용 중인 이메일입니다." }
```
(HTTP 상태 코드 409 Conflict — "이미 존재하는 리소스와 충돌")

---

## 마무리

이번 편에서는 회원가입/로그인 API와, 로그인 상태를 안전하게 유지하기 위한
JWT 기반 인증 시스템을 만들어봤습니다. 다음 편에서는 이 인증 시스템을
활용해서 **로그인한 사용자만 자신의 게시글을 쓰고, 수정하고, 삭제할 수 있는
"소유권 기반 게시글 CRUD"**를 구현해보겠습니다.
