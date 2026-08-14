# 🗂️ lsh_blog 구현 태스크 목록 (세분화)

> 각 태스크는 **1~4시간 이내**에 완료 가능한 단위로 분리했습니다.  
> onggi-shop `tasks.md` 형식을 그대로 참고하여 작성했습니다.

---

## 진행 상태 범례
- `[ ]` 미시작
- `[~]` 진행 중
- `[x]` 완료

---

## 📦 PHASE 0 — 프로젝트 초기 세팅

### 0-1. 개발 환경 구성
- [x] **T001** Node.js / pnpm 버전 확인 (Node v22.20.0 / npm 10.9.3 / pnpm 10.33.0)
- [x] **T002** VS Code 익스텐션 확인 (ESLint, Prettier, Prisma, Tailwind CSS IntelliSense) — 모두 설치됨, `.vscode/extensions.json`에 권장 확장 등록
- [x] **T003** GitHub 레포지토리 생성 (`lsh_blog`) — `origin: ssstriples/lsh_blog` 연결 확인
- [x] **T004** `.gitignore` 작성 (node_modules, .env, .next)

### 0-2. 프론트엔드 스캐폴딩
- [x] **T005** `pnpm create next-app` — Next.js (TypeScript + App Router + Tailwind) — `frontend/` 생성, Next.js 16 / React 19
- [x] **T006** `src/` 디렉토리 구조 생성 (app / components / lib / hooks / types / store)
- [x] **T007** ESLint + Prettier 설정 — `eslint-config-prettier`, `prettier-plugin-tailwindcss` 적용
- [x] **T008** `shadcn/ui` 초기화
- [x] **T009** 공통 컴포넌트 설치 (Button, Input, Card, Dialog, Badge, Toast→sonner)
- [x] **T009-S** `next-themes` 설치 및 다크모드 ThemeToggle 컴포넌트 구현
- [x] **T009-D** 📄 개발 이력 문서화 — `docs/dev-log/`에 Phase 0-1/0-2 상세 로그 작성 + `content/posts/`에 초보자용 블로그 게시글 초안 작성

> 📝 **문서화 규칙**: 이후 모든 Phase/기능 구현 완료 시, `docs/dev-log/YYYY-MM-DD_phaseX-Y_주제.md`에 상세 개발 로그를,
> 기능 단위(로그인, 게시글 CRUD 등) 완료 시 `content/posts/`에 초보자 친화적 블로그 원고를 함께 작성한다.

### 0-3. 백엔드 초기 세팅
- [x] **T010** `backend/` Express 프로젝트 생성
- [x] **T011** Express 기본 서버 구성 (`app.ts`, `server.ts`, cors, json 미들웨어)
- [x] **T012** 폴더 구조 생성 (routes / controllers / services / middlewares / schemas / lib)
- [x] **T013** `nodemon` + `ts-node` 개발 서버 실행 설정
- [x] **T013-S** 🔐 `helmet` 보안 헤더 설정
- [x] **T013-S2** 🔐 전역 Rate Limiting 설정 (`express-rate-limit`)
- [x] **T013-S3** 🔐 전역 에러 핸들러 (스택 트레이스 미노출)
- [x] **T013-S4** 🔐 `winston` 로거 설정
- [x] **T013-S5** 🔐 CORS 허용 출처 명시적 제한
- [x] **T013-D** 📄 개발 이력 문서화 — `docs/dev-log/2026-08-07_phase0-3_backend-setup.md` + 블로그 게시글 #2 작성

### 0-4. 데이터베이스 세팅
- [x] **T014** Prisma Postgres(클라우드) 프로젝트 생성 및 연결 URL 확보 (`lsh_blog`, ap-northeast-1)
- [x] **T015** 백엔드에 Prisma 설치 (`prisma` v7.9.1, `@prisma/client`, `@prisma/adapter-pg`, `pg`)
- [x] **T016** `prisma.config.ts` 작성 및 `DATABASE_URL` 설정 (Prisma 7 신규 설정 방식 — datasource url이 schema.prisma에서 분리됨)
- [x] **T017** `schema.prisma`에 [`03_db_schema_erd.md`](./docs/03_db_schema_erd.md) 전체 모델 작성 후 `prisma generate` 확인 — 드라이버 어댑터(`PrismaPg`) 적용, `/health` 엔드포인트에서 DB 연결 확인 완료
- [x] **T017-D** 📄 개발 이력 문서화 — `docs/dev-log/2026-08-07_phase0-4_database-setup.md` + 블로그 게시글 #3 작성

### 0-5. 환경변수 관리
- [x] **T018** `.env.local` (Next.js) — `NEXT_PUBLIC_API_URL` 등록 (NEXTAUTH_SECRET/URL은 Phase 2-3 NextAuth 도입 시 `.env.example`에 주석으로 안내, 실사용 시점에 추가)
- [x] **T019** `.env` (Backend) — DATABASE_URL, JWT_ACCESS/REFRESH_SECRET, PORT(4100), CORS_ORIGIN, LOG_LEVEL 등 모두 설정 완료
- [x] **T020** `.env.example` 작성 — `frontend/.env.example`, `backend/.env.example` 모두 작성
- [x] **T020-S** 🔐 `.gitignore`에 `.env*`, `*.pem` 추가 확인 — `frontend/.gitignore`가 `.env*`를 전부 무시해 `.env.example`까지 가려지던 문제 발견, `!.env.example` 예외 규칙 추가로 수정
- [x] **T020-S2** 🔐 JWT_ACCESS_SECRET / JWT_REFRESH_SECRET 랜덤 생성 (서로 다른 값, 각 96자리 hex)
- [x] **T020-S3** 🔐 서버 시작 시 필수 환경변수 런타임 검증 (`validateEnv.ts`, `DATABASE_URL` 포함 5개 항목 확인)

---

## 🗄️ PHASE 1 — DB 스키마 설계

- [x] **T021** `User` 모델 작성 (id, email, password, name, role, status, provider, providerId)
- [x] **T022** `Category` 모델 작성 (flat 구조)
- [x] **T023** `Tag`, `PostTag` 모델 작성 (N:M)
- [x] **T024** `Post` 모델 작성 (title, slug, content, status, viewCount, thumbnailUrl, authorId)
- [x] **T025** `Comment` 모델 작성 (parentId self-ref, guestName, userId)
- [x] **T026** `PostView`, `PostLike` 모델 작성 (조회수/좋아요 어뷰징 방지)
- [x] **T027** `prisma migrate dev --name init` 실행 및 테이블 생성 확인
- [x] **T028** ERD 관계 최종 검토 및 `prisma generate`

---

## 👤 PHASE 2 — 회원 인증 시스템 (회원가입 + 로그인)

> ⚠️ **2차 개정 (2026-08-07)**: "관리자 전용 로그인"에서 **"누구나 회원가입 후 로그인 가능"**으로 변경.
> 관리자(ADMIN)는 회원가입으로 생성된 계정 중 `role`을 수동으로 승격하는 방식(시드/DB 직접 수정)으로 운영.

### 2-0. 회원가입 API (Backend) 🆕
- [x] **T028-S** `POST /api/auth/signup` 라우트 생성 (이메일/비밀번호/닉네임)
- [x] **T028-S2** Zod 회원가입 입력 검증 (이메일 형식, 비밀번호 강도)
- [x] **T028-S3** 이메일 중복 체크 → 409 응답
- [x] **T028-S4** `bcrypt.hash()` 비밀번호 해싱 후 저장 (role: USER 기본값)
- [x] **T028-S5** 🔐 회원가입 Rate Limit (5회/1시간, 대량 가입 방지)

### 2-1. 로그인 API (Backend)
- [x] **T029** `POST /api/auth/login` 라우트 생성
- [x] **T030** Zod 입력 검증 스키마 작성
- [x] **T031** 이메일 조회 → `bcrypt.compare()` 비밀번호 검증
- [x] **T031-S** 🔐 `status === 'SUSPENDED'` 계정 로그인 차단 (403 + 안내 메시지)
- [x] **T032** Access Token(15분) 발급
- [x] **T033** Refresh Token(7일) → HttpOnly Cookie 설정
- [x] **T034** `POST /api/auth/refresh` — 재발급
- [x] **T035** `POST /api/auth/logout` — 쿠키 만료 처리
- [x] **T035-S** 🔐 로그인 Rate Limit (5회/15분)
- [x] **T035-S2** 🔐 이메일 열거/타이밍 어택 방지 로직 적용
- [x] **T035-S3** 🔐 로그인 성공/실패 보안 로그 기록

### 2-2. 인증/인가 미들웨어 (Backend)
- [x] **T036** `authMiddleware.ts` — JWT 검증 (로그인 여부만 확인)
- [x] **T037** `requireAdmin` — role === 'ADMIN' 체크 (모더레이션 라우트 전용, `authMiddleware.ts`에 포함)
- [x] **T037-S** 🆕 `ownershipMiddleware.ts` — 리소스의 `authorId`/`userId` === `req.user.id` 검증, ADMIN은 예외 통과 (팩토리 함수 `requireOwnership(getOwnerId)`로 구현, 게시글 CRUD에 적용)
- [x] **T038** 미들웨어 적용 테스트 — curl로 회원가입/로그인/리프레시/로그아웃/중복이메일(409) 케이스 검증 완료
- [x] **T038-D** 📄 개발 이력 문서화 — `docs/dev-log/2026-08-07_phase2_auth-system.md` + 블로그 게시글 #4 작성

### 2-3. 로그인/회원가입 화면 + NextAuth (Frontend)
- [x] **T039** NextAuth v5 설치 및 Credentials Provider 설정 (`frontend/src/lib/auth.ts` — authorize()가 백엔드 `/api/auth/login` 호출, jwt/session 콜백에서 accessToken 자동 갱신)
- [x] **T040** `/login` 페이지 생성 (모든 유저 대상) (`frontend/src/app/login/page.tsx`)
- [x] **T040-S** 🆕 `/signup` 페이지 생성 (이메일/비밀번호/닉네임 입력 폼) (`frontend/src/app/signup/page.tsx` — 가입 후 자동 로그인)
- [x] **T041** 로그인 성공 시 이전 페이지(또는 홈)로 리다이렉트, 실패 시 에러 표시 (callbackUrl 지원, 백엔드 에러 메시지 그대로 노출)
- [x] **T042** 헤더에 로그인 상태에 따른 "글쓰기 ✏️" 버튼 및 "마이페이지/로그아웃" 메뉴 노출 (`frontend/src/components/layout/header.tsx`)
- [x] **T043** 로그아웃 처리 (헤더 드롭다운에서 `signOut({ callbackUrl: "/" })`)
- [x] **T044** `/my/*` 경로 미들웨어 접근 제어 (비로그인 → `/login` 리다이렉트), `/admin/*`는 비관리자 → 403 (`frontend/src/proxy.ts` — Next.js 16 미들웨어 파일 컨벤션이 `proxy.ts`로 변경됨에 따라 리네임)
  - curl 기반 기능 테스트 완료: 회원가입 → NextAuth 로그인(세션 쿠키 발급) → `/api/auth/session` 확인 → `/my/*` 비로그인 시 `/login?callbackUrl=` 리다이렉트 → `/admin` 비관리자 접근 시 `/403` 리다이렉트 → 로그아웃 후 세션 클리어, 모두 정상 동작 확인

---

## 📝 PHASE 3 — 게시글 시스템 (전 유저 CRUD + 소유권 검증)

> ⚠️ **2차 개정 (2026-08-07)**: `/api/admin/posts` 관리자 전용 경로 → `/api/posts` 일반 경로 + Ownership 검증으로 변경.
> `/api/admin/posts`는 이제 "모더레이션(강제 삭제/비공개)" 전용 별도 라우트로 유지.

### 3-1. 게시글 CRUD API (Backend)
- [x] **T045** `POST /api/posts` — 생성 (slug 자동 생성 로직 포함, `authorId`는 `req.user.id`로 서버에서 강제 설정)
- [x] **T046** `PATCH /api/posts/:id` — 수정 (🔑 `ownershipMiddleware` 적용: 본인 글만, ADMIN 예외)
- [x] **T047** `DELETE /api/posts/:id` — 소프트 삭제 (🔑 소유권 검증, ADMIN 예외)
- [x] **T048** `PATCH /api/posts/:id/status` — DRAFT/PUBLISHED 전환 (🔑 소유권 검증)
- [x] **T049** `GET /api/posts` — 목록 (페이지네이션, 카테고리/태그/**작성자(authorId)** 필터, 정렬)
- [x] **T050** `GET /api/posts/:slug` — 상세 + 조회수 증가 (IP 해시 기반 중복 방지, `PostView` 활용)
- [x] **T050-S** 🔐 게시글 생성/수정 API에 XSS 방지용 서버사이드 DOMPurify sanitize 적용 (`isomorphic-dompurify`)
- [x] **T050-S2** 🆕 `GET /api/users/me/posts` — 내가 쓴 글 목록 (마이페이지, DRAFT 포함)
- [x] **T050-S3** 🆕 `GET /api/users/:id/posts` — 특정 작성자의 공개(PUBLISHED) 글 목록
- [x] **T050-S4** 🆕 `GET /api/admin/posts` — 전체 게시글 목록 (모더레이션용, 🛡️)
- [x] **T050-S5** 🆕 `DELETE /api/admin/posts/:id` — 관리자 강제 삭제/비공개 전환 (🛡️, 소유권 무관)
- [x] **T050-D** 📄 개발 이력 문서화 — `docs/dev-log/2026-08-10_phase3_post-crud-ownership.md` + 블로그 게시글 #5 작성

### 3-2. 이미지 업로드 (Backend)
- [x] **T051** Cloudinary 설정 및 `POST /api/posts/upload-image` 구현 (🔒 로그인 유저 누구나) — `lib/cloudinary.ts`, `services/uploadService.ts`(upload_stream으로 디스크에 파일 남기지 않음), 서버 시작 시 `CLOUDINARY_*` 환경변수 검증 추가
- [x] **T052** multer 미들웨어 연동 (파일 크기/타입 제한) — `middlewares/uploadMiddleware.ts`: 메모리 스토리지, 5MB 제한, jpeg/png/webp/gif만 허용, MulterError를 AppError로 변환하여 전역 에러 핸들러와 통합

### 3-3. 카테고리/태그 API (Backend)
- [x] **T053** `GET /api/categories`, `POST/PATCH/DELETE /api/admin/categories` (카테고리는 계속 관리자 전용) — `categorySchema.ts`/`categoryService.ts`/`categoryController.ts`/`categoryRoutes.ts` 신규 작성, `adminRoutes.ts`에 관리자 CRUD 등록. 한글 카테고리명 slug 생성 시 `slugify` strict 모드가 비-라틴 문자를 전부 제거해 빈 슬러그가 되는 버그를 발견해 fallback 로직 추가로 수정
- [x] **T054** `GET /api/tags`, 태그 생성은 게시글 저장 시 자동 upsert (모든 유저 가능) — upsert 로직은 `postService.ts`에 이미 구현되어 있었고, 이번에 `GET /api/tags` 목록 라우트(게시글 수 많은 순 정렬) 추가 완료
  - 기능 테스트 완료(Node fetch 기반, 터미널 한글 인코딩 문제 우회): 카테고리 생성(한글명 slug 정상 생성 확인)/수정/삭제, 비로그인 생성 시도 401 차단, `GET /api/categories`·`GET /api/tags` 공개 조회 모두 정상 동작 확인

### 3-4. 게시글 목록/상세 (Frontend)
- [ ] **T055** TanStack Query 설정 및 `usePosts`, `usePost`, **`useMyPosts`** 훅 작성
- [ ] **T056** 홈(`/`) 페이지 — PostCard 그리드(작성자 닉네임 표시) + 페이지네이션
- [ ] **T057** `/category/[slug]`, `/tag/[slug]` 목록 페이지
- [ ] **T057-S** 🆕 `/users/[id]` 작성자 공개 프로필 페이지 (해당 유저의 PUBLISHED 글 목록)
- [ ] **T058** `/posts/[slug]` 상세 페이지 (ISR 적용) — 본인 글일 경우 수정/삭제 버튼 노출
- [ ] **T059** TipTap 콘텐츠 렌더러 컴포넌트 (`PostContent`) + DOMPurify sanitize
- [ ] **T060** Shiki 코드 하이라이팅 적용
- [ ] **T061** 목차(TOC) 자동 생성 (heading 파싱)

### 3-5. 게시글 작성/수정 (Frontend) — 🔒 로그인 유저 누구나
- [ ] **T062** TipTap `RichTextEditor` 컴포넌트 이식 (onggi-shop 기반 + 코드블록 확장), `components/write/`로 위치
- [ ] **T063** `/my/posts` 마이페이지 목록 (검색/필터/상태 배지, 본인 글만 조회)
- [ ] **T064** `/posts/new` 작성 페이지 (제목/슬러그/카테고리/태그/썸네일/본문) — 로그인 필요
- [ ] **T065** `/posts/[id]/edit` 수정 페이지 — 작성자 본인 아니면 403 페이지로 리다이렉트
- [ ] **T066** 임시저장 로직 (Zustand + localStorage, 30초 간격 자동저장)
- [ ] **T067** 발행/임시저장/삭제 버튼 및 상태 전환 UI (본인 글에만 노출)
- [ ] **T067-S** 🆕 `/admin/posts` 전체 게시글 모더레이션 페이지 (작성자 표시, 강제 삭제/비공개 액션)

---

## 💬 PHASE 4 — 댓글 시스템

### 4-1. 댓글 API (Backend)
- [ ] **T068** `GET /api/posts/:postId/comments` — 트리 구조 조회 (parentId 재귀)
- [ ] **T069** `POST /api/posts/:postId/comments` — 작성 (로그인 또는 게스트+간단 비밀번호)
- [ ] **T070** `DELETE /api/comments/:id` — 🔑 본인 댓글만 삭제 가능 (ownershipMiddleware 적용, ADMIN 예외)
- [ ] **T070-S** 🔐 댓글 작성 Rate Limit (스팸 방지, 10회/1분)
- [ ] **T070-S2** 🔐 댓글 내용 XSS sanitize

### 4-2. 댓글 UI (Frontend)
- [ ] **T071** `CommentList`, `CommentItem`(대댓글 포함) 컴포넌트 — 본인 댓글에만 삭제 버튼 노출
- [ ] **T072** `CommentForm` (로그인/게스트 분기)
- [ ] **T073** 게시글 상세 페이지에 댓글 영역 통합

### 4-3. 관리자 댓글 모더레이션
- [ ] **T074** `GET /api/admin/comments` — 전체 댓글 목록 API (🛡️, 소유권 무관 전체 조회)
- [ ] **T075** `/admin/comments` 페이지 — 스팸/악성 댓글 강제 삭제 UI

---

## 🔍 PHASE 5 — 검색 & 좋아요 & 통계

### 5-1. 검색
- [ ] **T076** `GET /api/search?q=` — 제목+본문 `ILIKE` 검색 API
- [ ] **T077** `/search` 페이지 — 검색창 + 결과 목록

### 5-2. 좋아요
- [ ] **T078** `POST /api/posts/:postId/like` — 토글 API (쿠키 기반 guestId)
- [ ] **T079** 게시글 상세에 좋아요 버튼 UI

### 5-3. 관리자 대시보드 & 회원 관리
- [ ] **T080** `GET /api/admin/dashboard` — 통계 집계 API (총 유저/게시글/조회수/댓글, 인기글 Top5)
- [ ] **T081** `/admin` 대시보드 페이지 — Recharts 조회수 추이 차트
- [ ] **T082** 인기글 Top5 / 최근 댓글 위젯
- [ ] **T082-S** 🆕 `GET /api/admin/users` — 전체 회원 목록 API (🛡️)
- [ ] **T082-S2** 🆕 `PATCH /api/admin/users/:id/status` — 회원 정지/정지 해제 API (🛡️)
- [ ] **T082-S3** 🆕 `/admin/users` 페이지 — 회원 목록 + 정지/해제 액션 UI

---

## 🤖 PHASE 6 — AI 명세서 작성 파이프라인

- [ ] **T083** 요구조건 명세서 생성 프롬프트 템플릿 확정 (`05_ai_writing_pipeline.md` 기반)
- [ ] **T084** 상세 기술 명세서 생성 프롬프트 템플릿 확정
- [ ] **T085** (선택) 관리자 글쓰기 화면에 "AI 초안 생성" 버튼 추가 → 프롬프트 체인 호출
- [ ] **T086** 생성된 문서를 `docs/generated/`에 저장하는 스크립트 작성
- [ ] **T087** AI 파이프라인 사용기를 블로그 게시글로 발행 (첫 콘텐츠)

---

## 🎨 PHASE 7 — SEO & 마무리 UI

- [ ] **T088** 메타 태그 / OG 이미지 동적 생성 (게시글별)
- [ ] **T089** `sitemap.xml` 자동 생성 (`next-sitemap`)
- [ ] **T090** `robots.txt` 작성
- [ ] **T091** JSON-LD 구조화 데이터 (BlogPosting) 삽입
- [ ] **T092** RSS 피드(`/rss.xml`) 구현
- [ ] **T093** 반응형 레이아웃 최종 점검 (모바일/태블릿)
- [ ] **T094** 다크모드 대비율(WCAG AA) 점검
- [ ] **T095** Lighthouse 성능/SEO/접근성 점검 및 개선

---

## 🚀 PHASE 8 — 배포 & CI/CD

- [ ] **T096** Frontend Vercel 배포 설정 (환경변수 등록)
- [ ] **T097** Backend Railway(또는 대체 호스팅) 배포 설정
- [ ] **T098** GitHub Actions — 빌드/린트 자동화 워크플로우
- [ ] **T099** GitHub Actions — 보안 감사(pnpm audit) 워크플로우
- [ ] **T100** 도메인 연결 및 HTTPS 설정
- [ ] **T101** 배포 후 스모크 테스트 (로그인/글 작성/댓글/검색 전체 플로우 점검)

---

## 📋 참고

- 각 Phase 완료 전 보안 관련 태스크(`-S` 접미사)는 필수로 통과해야 완료로 간주합니다 (onggi-shop `SECURITY_CHECKLIST.md` 원칙 준용).
- 문서 매핑: 요구사항 → [`docs/01_requirements_draft.md`](./docs/01_requirements_draft.md), 기술명세 → [`docs/02_tech_spec_detail.md`](./docs/02_tech_spec_detail.md), DB → [`docs/03_db_schema_erd.md`](./docs/03_db_schema_erd.md), API → [`docs/04_api_endpoints.md`](./docs/04_api_endpoints.md), 페이지 → [`docs/06_pages_wireframe.md`](./docs/06_pages_wireframe.md), AI 파이프라인 → [`docs/05_ai_writing_pipeline.md`](./docs/05_ai_writing_pipeline.md)
