# 🛠️ 상세 기술 명세서 — lsh_blog

> [`01_requirements_draft.md`](./01_requirements_draft.md) 기반 상세화. onggi-shop 아키텍처/보안 패턴 재사용.
> ⚠️ **2차 개정 (2026-08-07)**: 관리자 전용 CRUD → **회원(USER) 소유권 기반 CRUD + 관리자 모더레이션** 구조로 변경.

## 1. 전체 아키텍처

```
[Frontend: Next.js 16 App Router]        [Backend: Express v5 + Prisma v7]
  posts/new (TipTap, 로그인 필요)   ──POST /api/posts──▶  post.controller ──▶ ownership 불필요(생성 시 본인=author)
  posts/[slug] (SSR/ISR)         ──GET  /api/posts/:slug──▶  post.service ──▶ Prisma ──▶ PostgreSQL
  posts/[id]/edit (본인 글만)      ──PATCH /api/posts/:id──▶ ownershipMiddleware ──▶ post.controller
  my/posts (마이페이지)           ──GET  /api/users/me/posts──▶ post.service
  comments (CSR + mutate)        ──POST /api/posts/:id/comments──▶ comment.controller
```

- Frontend: Vercel 배포, ISR(revalidate)로 게시글 상세 캐싱
- Backend: Railway(또는 자체 서버) 배포, PostgreSQL(Supabase)
- 인증: NextAuth v5(JWT strategy) + Express 자체 JWT 검증(Access 15분/Refresh 7일, 이중 시크릿)
- **인가(Authorization)**: 로그인 필요 라우트는 `authMiddleware`로 JWT 검증 → 게시글/댓글 수정·삭제는
  추가로 `ownershipMiddleware`(또는 서비스 레이어 내 검증)로 "요청자 == 리소스 소유자 또는 ADMIN"을 확인

## 2. 기술 스택 (확정)

| 영역 | 기술 | 비고 |
|------|------|------|
| Frontend | Next.js 16, React 19, TailwindCSS 4, shadcn/ui | onggi-shop과 동일 버전 |
| 에디터 | TipTap (Image, Table, TextAlign, Underline, Placeholder) | 코드블록 확장 추가 필요 (`@tiptap/extension-code-block-lowlight`) |
| 상태관리 | TanStack Query(서버), Zustand(다크모드, 임시저장) | |
| 폼 | react-hook-form + zod | |
| Backend | Node.js, Express v5, TypeScript | |
| ORM | Prisma v7 (driver adapter, PrismaPg) | |
| 인증 | jsonwebtoken, bcryptjs, next-auth v5 | Credentials Provider — **회원가입은 별도 `/api/auth/signup` API** |
| 이미지 | Cloudinary | |
| 검색 | PostgreSQL `ILIKE` (1차) → 추후 `pg_trgm`/Meilisearch 검토 | |
| 코드 하이라이팅 | Shiki (SSR 하이라이팅) | |
| 로깅 | winston | |
| 보안 | helmet, express-rate-limit, cors, DOMPurify | + **Ownership Authorization 미들웨어** |

## 3. DB 스키마 개요 (상세는 [`03_db_schema_erd.md`](./03_db_schema_erd.md))

- `User` (role: `USER`(기본) / `ADMIN`, 이메일+비밀번호 기반 회원가입, `status`(ACTIVE/SUSPENDED) 필드 추가)
- `Post` (title, slug, content, thumbnailUrl, status: DRAFT/PUBLISHED, viewCount, categoryId, **authorId — 작성자 = 소유자**)
- `Category` (self-ref 트리 구조 재사용 안 함 → 단순 flat 카테고리로 축소, 필요시 확장)
- `Tag`, `PostTag` (N:M)
- `Comment` (postId, userId/guestName, parentId — 대댓글 대비 nullable, **authorId = 작성자**)
- `PostView` (조회수 중복 방지용 로그, optional — IP+날짜 unique)
- `PostLike` (postId, userId/guestId)

## 4. API 설계 상세 (요약, 전체는 [`04_api_endpoints.md`](./04_api_endpoints.md))

### 인증 / 회원
```
POST /api/auth/signup       회원가입 (이메일/비밀번호/닉네임)
POST /api/auth/login        로그인 → Access Token + Refresh Cookie
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/users/me          내 프로필 조회
GET  /api/users/me/posts    내가 쓴 글 목록 (마이페이지)
```

### 게시글 (관리자 전용 경로 폐지 → 일반 경로 + 소유권 검증)
```
GET    /api/posts                 목록 (page, limit, category, tag, sort, q, authorId)
GET    /api/posts/:slug           상세 (조회수 증가 트랜잭션)
POST   /api/posts                 생성 � (로그인만 필요, author = 요청자)
PATCH  /api/posts/:id             수정 �+소유권 (본인 글만, ADMIN은 예외)
DELETE /api/posts/:id             소프트 삭제 �+소유권 (본인 글만, ADMIN은 예외)
PATCH  /api/posts/:id/status      DRAFT↔PUBLISHED 전환 �+소유권
```

### 카테고리/태그 (변경 없음 — 관리자만 카테고리 CRUD, 태그는 게시글 저장 시 자동 upsert)
```
GET  /api/categories
GET  /api/tags
POST /api/admin/categories 🛡️  (카테고리 체계는 관리자가 관리 — CRUD 세트 동일 패턴)
```

### 댓글 (일반 경로 + 소유권 검증)
```
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments      🔒(선택적 게스트 허용 - 이름/비번)
DELETE /api/comments/:id            🔒+소유권 (본인 댓글 또는 ADMIN)
```

### 관리자 모더레이션 (신규/변경)
```
GET   /api/admin/dashboard    총 유저/게시글 수, 총 조회수, 인기글 Top5, 최근 댓글
GET   /api/admin/posts        전체 게시글 목록 (다른 유저 글 포함, 모더레이션용)
DELETE /api/admin/posts/:id   임의 게시글 강제 삭제/비공개 전환 🛡️
GET   /api/admin/users        전체 회원 목록 🛡️
PATCH /api/admin/users/:id/status   회원 정지/해제 🛡️
```

## 5. 컴포넌트 설계 (Frontend)

```
components/
├── layout/ (Header, Footer, ThemeToggle, MobileMenu)
├── post/ (PostCard, PostList, PostContent(TipTap 렌더러), TableOfContents, CodeBlock)
├── comment/ (CommentList, CommentForm, CommentItem)
├── write/ (RichTextEditor, PostForm, DraftAutoSaveIndicator) — 모든 로그인 유저가 접근 가능
├── mypage/ (MyPostList, ProfileSummary) — 마이페이지 전용
├── admin/ (AdminPostTable, AdminUserTable, StatsChart) — 관리자 모더레이션 전용
└── common/ (Pagination, SearchBar, Skeleton, EmptyState)
```

- `PostContent`: TipTap JSON → HTML 렌더링 시 DOMPurify sanitize, Shiki로 code 블록 하이라이팅
- `RichTextEditor`: onggi-shop `admin/RichTextEditor.tsx` 기반 이식 + 코드블록 확장 추가, **`/posts/new`, `/posts/[id]/edit` 양쪽에서 모든 로그인 유저가 사용**
- 다크모드: `next-themes` 사용, `ThemeToggle` 헤더에 배치

## 6. 상태 전이

### 게시글 상태
```
DRAFT ──(발행)──▶ PUBLISHED ──(비공개 전환)──▶ DRAFT
PUBLISHED ──(삭제: 본인 또는 ADMIN)──▶ deletedAt 설정(soft delete)
```

### 회원 상태 (신규)
```
ACTIVE ──(관리자 정지)──▶ SUSPENDED ──(관리자 정지 해제)──▶ ACTIVE
ACTIVE ──(본인 탈퇴)──▶ deletedAt 설정 (연관 게시글은 유지, author 표시만 "탈퇴한 회원"으로 대체)
```

## 7. 보안 고려사항 (onggi-shop 재사용 + 신규)

| 항목 | 적용 |
|------|------|
| 이메일 열거/타이밍 어택 방지 | 로그인/회원가입에도 동일 패턴 적용 |
| JWT 이중 시크릿 | Access/Refresh 별도 secret, HttpOnly Cookie |
| Rate Limiting | 로그인 5회/15분, 회원가입 5회/1시간, 댓글 작성 10회/1분(스팸 방지) |
| XSS | TipTap 출력 HTML DOMPurify sanitize (서버/클라 이중) |
| Helmet | CSP, HSTS 등 보안 헤더 |
| 소프트 삭제 | Post/Comment/User `deletedAt` |
| 조회수 어뷰징 방지 | IP+PostId+날짜 unique 제약으로 중복 카운트 방지 |
| **Ownership Authorization (신규)** | 게시글/댓글 수정·삭제 API는 서비스 레이어에서 `resource.authorId === req.user.id \|\| req.user.role === 'ADMIN'` 검증 필수. 실패 시 403 반환 |
| **회원 정지 처리 (신규)** | `SUSPENDED` 상태 유저는 로그인/글쓰기/댓글 작성 차단 (로그인 시 403 + 안내 메시지) |

## 8. 테스트 케이스 (예시)

| 케이스 | 기대 결과 |
|--------|----------|
| 비공개(DRAFT) 게시글 직접 URL 접근 (작성자 본인 아님) | 404 또는 403 |
| 동일 IP로 1분 내 댓글 10회 초과 작성 | 429 응답 |
| 삭제된 게시글 조회 | 404 |
| **로그인한 유저 A가 유저 B의 게시글을 PATCH/DELETE 시도** | **403 Forbidden** |
| **ADMIN이 임의 유저의 게시글을 삭제** | 200 성공 (모더레이션 목적 예외 허용) |
| **정지(SUSPENDED)된 유저의 로그인 시도** | 403 + "정지된 계정입니다" 메시지 |
| 잘못된 slug 접근 | 404 페이지 노출 |

## 9. 다음 단계

→ `03_db_schema_erd.md`, `04_api_endpoints.md` 상세화 → `tasks.md`에 따라 Phase 0부터 구현 시작

