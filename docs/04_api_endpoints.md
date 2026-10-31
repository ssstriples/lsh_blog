# 🔌 API 엔드포인트 목록 — lsh_blog

> Base URL: `http://localhost:4100` (개발, onggi-shop 4000과 포트 분리)
> ⚠️ **2차 개정 (2026-08-07)**: 게시글/댓글 CRUD를 `/api/admin/*` 관리자 전용 경로에서
> **`/api/posts`, `/api/comments` 일반 경로 + 소유권 검증(Ownership Authorization)** 방식으로 변경.
> `/api/admin/*`는 이제 "모더레이션(전체 관리)" 목적으로만 사용.

## 인증 방식

```
Authorization: Bearer <accessToken>
Cookie: refreshToken=<token>  (HttpOnly; Secure; SameSite=Strict; path=/api/auth/refresh)
```

| 아이콘 | 의미 |
|---|---|
| 🔓 | 인증 불필요 |
| 🔒 | 로그인 필요 |
| � | 로그인 + **소유권 검증** (본인 리소스만, ADMIN은 예외 허용) |
| �🛡️ | 관리자 전용 |

## 1. 인증 / 회원 (`/api/auth`, `/api/users`)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/auth/signup` | 🔓 | **회원가입 (이메일/비밀번호/닉네임)** |
| POST | `/api/auth/login` | 🔓 | 로그인 |
| POST | `/api/auth/refresh` | 🔓 | Access Token 재발급 |
| POST | `/api/auth/logout` | 🔒 | 로그아웃 |
| GET | `/api/users/me` | 🔒 | 내 프로필 조회 |
| PATCH | `/api/users/me` | 🔒 | 내 프로필 수정 (닉네임 등) |
| DELETE | `/api/users/me` | 🔒 | 회원 탈퇴 (소프트 삭제) |
| GET | `/api/users/me/posts` | 🔒 | **내가 쓴 글 목록 (마이페이지)** — DRAFT 포함, `page`, `limit`, `q`(제목), `status`(DRAFT/PUBLISHED) |
| GET | `/api/users/:id` | 🔓 | 작성자 공개 프로필 (닉네임, 작성 글 수 등) |
| GET | `/api/users/:id/posts` | 🔓 | **특정 작성자의 공개(PUBLISHED) 게시글 목록** |

### POST `/api/auth/signup` 예시
```json
// Request
{ "email": "user@example.com", "password": "P@ssw0rd!", "name": "홍길동" }

// Response 201
{
  "success": true,
  "data": { "id": "cuid_...", "email": "user@example.com", "name": "홍길동", "role": "USER" }
}

// Response 409 (이메일 중복)
{ "success": false, "message": "이미 사용 중인 이메일입니다." }
```

## 2. 게시글 (`/api/posts`)

> 이전에는 `POST/PATCH/DELETE /api/admin/posts`로 관리자만 접근 가능했지만,
> 이제 **로그인한 모든 유저**가 자신의 글에 한해 생성/수정/삭제할 수 있습니다.

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/posts` | 🔓 | 목록 (page, limit, category, tag, q, sort, **authorId**) |
| GET | `/api/posts/:slug` | 🔓 | 상세 (조회수 증가) |
| GET | `/api/posts/:id/edit` | 🔑 | **수정 화면 진입용 조회** — DRAFT 포함, 조회수 증가 없음, 본인 글만 가능 (ADMIN 예외) |
| POST | `/api/posts` | � | **생성** — `authorId`는 서버에서 `req.user.id`로 자동 설정 (요청 바디로 임의 지정 불가) |
| PATCH | `/api/posts/:id` | � | **수정** — 본인 글만 가능 (ADMIN 예외) |
| DELETE | `/api/posts/:id` | � | **소프트 삭제** — 본인 글만 가능 (ADMIN 예외) |
| PATCH | `/api/posts/:id/status` | � | DRAFT/PUBLISHED 전환 — 본인 글만 가능 (ADMIN 예외) |
| POST | `/api/posts/upload-image` | � | 에디터 이미지 업로드 (Cloudinary, 로그인 유저 누구나) |

### GET `/api/posts` 예시
```json
// Query: ?page=1&limit=10&category=dev&tag=nextjs&q=검색어&sort=latest&authorId=cuid_...
// Response 200
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "...", "title": "...", "slug": "...", "thumbnailUrl": "...",
        "viewCount": 120, "publishedAt": "...",
        "author": { "id": "cuid_...", "name": "홍길동" }
      }
    ],
    "pagination": { "page": 1, "totalPages": 5, "totalCount": 48 }
  }
}
```

### PATCH `/api/posts/:id` — 소유권 검증 실패 예시
```json
// 로그인은 했으나 이 게시글의 authorId와 req.user.id가 다른 경우
// Response 403
{ "success": false, "message": "본인이 작성한 게시글만 수정할 수 있습니다." }
```

## 3. 카테고리 / 태그

> 카테고리 체계는 사이트 전체에 영향을 주므로 계속 관리자만 CRUD 가능. 태그는 게시글 저장 시 자동 upsert(모든 유저 가능).

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/categories` | 🔓 | 카테고리 목록 |
| GET | `/api/tags` | 🔓 | 태그 목록 |
| POST | `/api/admin/categories` | 🛡️ | 카테고리 생성 |
| PATCH | `/api/admin/categories/:id` | 🛡️ | 수정 |
| DELETE | `/api/admin/categories/:id` | 🛡️ | 삭제 |

## 4. 댓글 (`/api/posts/:postId/comments`)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/posts/:postId/comments` | 🔓 | 댓글 목록 (대댓글 포함 트리, `totalCount`). 답글이 남은 삭제 댓글은 `isDeleted: true`로 자리만 유지 |
| POST | `/api/posts/:postId/comments` | 🔓(게스트 허용) | 댓글 작성 — 로그인 시 `userId` 서버 강제 설정, 비로그인 시 `guestName`+`guestPassword` 필수. 10회/1분 Rate Limit, 평문 sanitize |
| DELETE | `/api/comments/:id` | 🔑 | **삭제 — 본인 댓글만 가능 (ADMIN 예외, ADMIN은 게스트 댓글도 삭제 가능)** |
| POST | `/api/comments/:id/guest-delete` | 🔓 | 게스트 댓글 삭제 — `{ password }` 확인 (실패 10회/15분 Rate Limit) |

### POST `/api/posts/:postId/comments` 예시
```json
// Request (비로그인)
{ "content": "좋은 글 감사합니다", "parentId": null, "guestName": "지나가던손님", "guestPassword": "1234" }

// Response 201 — 비밀번호(해시)는 응답에 절대 포함하지 않는다
{
  "success": true,
  "data": {
    "id": "cuid_...", "parentId": null, "content": "좋은 글 감사합니다",
    "createdAt": "2026-10-31T...", "isDeleted": false,
    "author": { "type": "guest", "name": "지나가던손님" },
    "replies": []
  }
}
```

## 5. 좋아요

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/posts/:postId/like` | 🔓 | 내 좋아요 여부 + 전체 수 `{ liked, likeCount }` (로그인=계정, 비로그인=`guestId` 쿠키, 쿠키 없으면 liked=false) |
| POST | `/api/posts/:postId/like` | 🔓(쿠키 기반) | 좋아요 토글 — 비로그인 첫 요청 시 서버가 HttpOnly `guestId` 쿠키(`path=/api/posts`) 발급. 프론트는 `credentials: "include"` 필요. 30회/1분 Rate Limit |

## 6. 검색

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/search?q=` | 🔓 | 제목+본문 검색 (ILIKE, 공개 글만) — `q`(1~100자 필수), `page`, `limit`. 본문 대신 검색어 주변 `excerpt` 반환 |

## 7. 관리자 모더레이션 (`/api/admin`)

> ⚠️ 기존 "게시글/댓글 CRUD 전담" 역할에서 **"전체 콘텐츠 모더레이션 + 회원 관리"** 역할로 축소·변경.

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/admin/dashboard` | 🛡️ | `totals`(회원/게시글/조회수/댓글), `popularPosts`(Top5, 좋아요·댓글 수), `recentComments`(5), `viewTrend`(최근 14일 KST 일별 조회수, 빈 날 0). 삭제된 글의 조회·댓글은 제외 |
| GET | `/api/admin/posts` | 🛡️ | **전체 게시글 목록** (다른 유저 글 포함, 모더레이션용) — `page`, `limit`, `q`(제목/작성자명), `status` |
| DELETE | `/api/admin/posts/:id` | 🛡️ | **임의 게시글 강제 삭제** (스팸/악성 콘텐츠 대응). 비공개 전환은 `PATCH /api/posts/:id/status`를 재사용 (소유권 검증에서 ADMIN 예외 통과) |
| GET | `/api/admin/comments` | 🛡️ | 전체 댓글 목록 — `page`, `limit`, `q`(내용/게스트명/회원명), 게시글·작성자 이메일 포함 |
| DELETE | `/api/admin/comments/:id` | 🛡️ | 댓글 강제 삭제 (소유권 무관, 소프트 삭제) |
| GET | `/api/admin/users` | 🛡️ | **전체 회원 목록** — `page`, `limit`, `q`(닉네임/이메일), `status`(ACTIVE/SUSPENDED), 글·댓글 수 포함 (password 미포함) |
| PATCH | `/api/admin/users/:id/status` | 🛡️ | **회원 정지(SUSPENDED)/정지 해제(ACTIVE)** — 본인 400, 다른 ADMIN 403. 정지 즉시 남은 Access Token으로도 글쓰기/댓글 차단(`requireActiveUser`) |
| GET | `/api/admin/ai/status` | 🛡️ | AI 기능 사용 가능 여부 `{ enabled, model }` (서버에 `ANTHROPIC_API_KEY`가 있는지만 알려주고 값은 노출하지 않음) |
| POST | `/api/admin/ai/draft` | 🛡️ | **AI 블로그 초안 생성** — `{ idea (5~2000자), sourceDocument? (~60,000자) }` → `{ title, summary, tags, html, model, usage }`. 저장하지 않음(에디터에 로드). 성공 기준 1시간 10회. 키 없음 503 / 거절 422 / 잘림·응답 해석 실패 502 / AI 측 429 → 429 |

### PATCH `/api/admin/users/:id/status` 예시
```json
// Request
{ "status": "SUSPENDED", "reason": "스팸성 게시글 반복 등록" }

// Response 200
{ "success": true, "data": { "id": "cuid_...", "status": "SUSPENDED" } }
```

## 8. RSS / Sitemap (Should Have)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/rss.xml` | 🔓 | RSS 피드 |
| GET | `/sitemap.xml` | 🔓 | 사이트맵 (next-sitemap) |

