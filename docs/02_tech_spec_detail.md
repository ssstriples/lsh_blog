# 🛠️ 상세 기술 명세서 — lsh_blog

> [`01_requirements_draft.md`](./01_requirements_draft.md) 기반 상세화. onggi-shop 아키텍처/보안 패턴 재사용.

## 1. 전체 아키텍처

```
[Frontend: Next.js 16 App Router]        [Backend: Express v5 + Prisma v7]
  admin/posts/new (TipTap)  ──POST /api/admin/posts──▶  post.controller
  posts/[slug] (SSR/ISR)    ──GET  /api/posts/:slug──▶  post.service ──▶ Prisma ──▶ PostgreSQL
  comments (CSR + mutate)   ──POST /api/posts/:id/comments──▶ comment.controller
```

- Frontend: Vercel 배포, ISR(revalidate)로 게시글 상세 캐싱
- Backend: Railway(또는 자체 서버) 배포, PostgreSQL(Supabase)
- 인증: NextAuth v5(JWT strategy) + Express 자체 JWT 검증(Access 15분/Refresh 7일, 이중 시크릿)

## 2. 기술 스택 (확정)

| 영역 | 기술 | 비고 |
|------|------|------|
| Frontend | Next.js 16, React 19, TailwindCSS 4, shadcn/ui | onggi-shop과 동일 버전 |
| 에디터 | TipTap (Image, Table, TextAlign, Underline, Placeholder) | 코드블록 확장 추가 필요 (`@tiptap/extension-code-block-lowlight`) |
| 상태관리 | TanStack Query(서버), Zustand(다크모드, 임시저장) | |
| 폼 | react-hook-form + zod | |
| Backend | Node.js, Express v5, TypeScript | |
| ORM | Prisma v7 (driver adapter, PrismaPg) | |
| 인증 | jsonwebtoken, bcryptjs, next-auth v5 | |
| 이미지 | Cloudinary | |
| 검색 | PostgreSQL `ILIKE` (1차) → 추후 `pg_trgm`/Meilisearch 검토 | |
| 코드 하이라이팅 | Shiki (SSR 하이라이팅) | |
| 로깅 | winston | |
| 보안 | helmet, express-rate-limit, cors, DOMPurify | |

## 3. DB 스키마 개요 (상세는 [`03_db_schema_erd.md`](./03_db_schema_erd.md))

- `User` (role: ADMIN 단일 관리자 + 선택적 방문자 계정)
- `Post` (title, slug, content, thumbnailUrl, status: DRAFT/PUBLISHED, viewCount, categoryId)
- `Category` (self-ref 트리 구조 재사용 안 함 → 단순 flat 카테고리로 축소, 필요시 확장)
- `Tag`, `PostTag` (N:M)
- `Comment` (postId, userId/guestName, parentId — 대댓글 대비 nullable)
- `PostView` (조회수 중복 방지용 로그, optional — IP+날짜 unique)
- `PostLike` (postId, userId/guestId)

## 4. API 설계 상세 (요약, 전체는 [`04_api_endpoints.md`](./04_api_endpoints.md))

### 인증
```
POST /api/auth/login        관리자 로그인 → Access Token + Refresh Cookie
POST /api/auth/refresh
POST /api/auth/logout
```

### 게시글
```
GET    /api/posts                 목록 (page, limit, category, tag, sort, q)
GET    /api/posts/:slug           상세 (조회수 증가 트랜잭션)
POST   /api/admin/posts           생성 🛡️
PATCH  /api/admin/posts/:id       수정 🛡️
DELETE /api/admin/posts/:id       소프트 삭제 🛡️
PATCH  /api/admin/posts/:id/status  DRAFT↔PUBLISHED 전환 🛡️
```

### 카테고리/태그
```
GET  /api/categories
GET  /api/tags
POST /api/admin/categories 🛡️  (CRUD 세트 동일 패턴)
```

### 댓글
```
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments      🔒(선택적 게스트 허용 - 이름/비번)
DELETE /api/comments/:id            🔒 or 🛡️
```

### 관리자 통계
```
GET /api/admin/dashboard   총 게시글 수, 총 조회수, 인기글 Top5, 최근 댓글
```

## 5. 컴포넌트 설계 (Frontend)

```
components/
├── layout/ (Header, Footer, ThemeToggle, MobileMenu)
├── post/ (PostCard, PostList, PostContent(TipTap 렌더러), TableOfContents, CodeBlock)
├── comment/ (CommentList, CommentForm, CommentItem)
├── admin/ (RichTextEditor, PostForm, DraftAutoSaveIndicator, StatsChart)
└── common/ (Pagination, SearchBar, Skeleton, EmptyState)
```

- `PostContent`: TipTap JSON → HTML 렌더링 시 DOMPurify sanitize, Shiki로 code 블록 하이라이팅
- `RichTextEditor`: onggi-shop `admin/RichTextEditor.tsx` 그대로 이식 + 코드블록 확장 추가
- 다크모드: `next-themes` 사용, `ThemeToggle` 헤더에 배치

## 6. 상태 전이

### 게시글 상태
```
DRAFT ──(발행)──▶ PUBLISHED ──(비공개 전환)──▶ DRAFT
PUBLISHED ──(삭제)──▶ deletedAt 설정(soft delete)
```

## 7. 보안 고려사항 (onggi-shop 재사용)

| 항목 | 적용 |
|------|------|
| 이메일 열거/타이밍 어택 방지 | 관리자 로그인에도 동일 패턴 적용 |
| JWT 이중 시크릿 | Access/Refresh 별도 secret, HttpOnly Cookie |
| Rate Limiting | 로그인 5회/15분, 댓글 작성 10회/1분(스팸 방지) |
| XSS | TipTap 출력 HTML DOMPurify sanitize (서버/클라 이중) |
| Helmet | CSP, HSTS 등 보안 헤더 |
| 소프트 삭제 | Post/Comment `deletedAt` |
| 조회수 어뷰징 방지 | IP+PostId+날짜 unique 제약으로 중복 카운트 방지 |

## 8. 테스트 케이스 (예시)

| 케이스 | 기대 결과 |
|--------|----------|
| 비공개(DRAFT) 게시글 직접 URL 접근 | 404 또는 403 |
| 동일 IP로 1분 내 댓글 10회 초과 작성 | 429 응답 |
| 삭제된 게시글 조회 | 404 |
| 관리자 아닌 사용자가 `/api/admin/*` 접근 | 403 |
| 잘못된 slug 접근 | 404 페이지 노출 |

## 9. 다음 단계

→ `03_db_schema_erd.md`, `04_api_endpoints.md` 상세화 → `tasks.md`에 따라 Phase 0부터 구현 시작
