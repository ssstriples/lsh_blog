# 📓 개발 이력 로그 (Dev Log)

> 이 폴더는 `tasks.md`의 각 태스크(T001, T002 …)를 실제로 진행하면서
> **"무엇을, 왜, 어떻게"** 했는지 상세히 기록하는 개발 일지입니다.
>
> - 목적 1: 나중에 같은 환경을 다시 세팅하거나, 다른 프로젝트에 이식할 때 참고
> - 목적 2: `content/posts/`에 있는 블로그 게시글의 "원본 재료"로 사용
> - 작성 원칙: **왜 이 선택을 했는지 근거**를 반드시 남긴다 (버전, 이유, 대안 비교 등)

## 로그 목록

| 파일 | Phase | 내용 | 날짜 |
|------|-------|------|------|
| [2026-08-07_phase0-1_dev-environment.md](./2026-08-07_phase0-1_dev-environment.md) | Phase 0-1 | Node/pnpm 버전 확인, VS Code 확장, GitHub 레포, `.gitignore` | 2026-08-07 |
| [2026-08-07_phase0-2_nextjs-scaffolding.md](./2026-08-07_phase0-2_nextjs-scaffolding.md) | Phase 0-2 | Next.js 16 프로젝트 생성, 폴더 구조, ESLint/Prettier, shadcn/ui, 다크모드 | 2026-08-07 |
| [2026-08-07_phase0-3_backend-setup.md](./2026-08-07_phase0-3_backend-setup.md) | Phase 0-3 | Express+TypeScript 서버, Helmet/RateLimit/에러핸들러/Winston/CORS 보안 미들웨어 | 2026-08-07 |
| [2026-08-07_phase0-4_database-setup.md](./2026-08-07_phase0-4_database-setup.md) | Phase 0-4 / Phase 1 | Prisma Postgres 연결, Prisma 7 신규 설정(`prisma.config.ts`), 드라이버 어댑터, 전체 스키마 설계+마이그레이션 | 2026-08-07 |
| [2026-08-10_phase0-5_env-management-followup.md](./2026-08-10_phase0-5_env-management-followup.md) | Phase 0-5 | 프론트엔드 `.env.local`/`.env.example` 추가, `frontend/.gitignore`의 `.env.example` 오차단 문제 수정, JWT 시크릿/필수 환경변수 검증 재확인 | 2026-08-10 |
| [2026-08-07_phase2_auth-system.md](./2026-08-07_phase2_auth-system.md) | Phase 2 | 회원가입/로그인/토큰 재발급/로그아웃 API, JWT Access+Refresh, bcrypt, Rate Limiting, 인증/인가 미들웨어 | 2026-08-07 |
| [2026-08-10_phase3_post-crud-ownership.md](./2026-08-10_phase3_post-crud-ownership.md) | Phase 3 | 게시글 CRUD API, 소유권 검증 미들웨어(`requireOwnership`), slug 자동 생성, DOMPurify XSS 방지, 마이페이지/공개 프로필/관리자 모더레이션 라우트 | 2026-08-10 |
| [2026-08-10_phase2-3_frontend-auth-nextauth.md](./2026-08-10_phase2-3_frontend-auth-nextauth.md) | Phase 2-3 | NextAuth v5 Credentials Provider로 백엔드 JWT 로그인 연결, refreshToken JSON 응답 워크어라운드, accessToken 자동 갱신, `/login`·`/signup` 화면, 헤더 로그인 상태, `/my/*`·`/admin/*` 라우트 보호(`middleware.ts`→`proxy.ts` 리네임) | 2026-08-10 |
| [2026-08-10_phase3-2_image-upload-cloudinary.md](./2026-08-10_phase3-2_image-upload-cloudinary.md) | Phase 3-2 | Cloudinary 이미지 업로드 API, multer memoryStorage + 5MB/타입 제한, MulterError→AppError 변환, `CLOUDINARY_*` 필수 환경변수 검증 추가 | 2026-08-10 |

## 작성 규칙

1. 파일명: `YYYY-MM-DD_phaseX-Y_주제.md`
2. 각 문서 상단에 관련 `tasks.md` 태스크 번호(T00X)를 명시
3. 명령어는 실제로 실행한 그대로 코드블록에 남긴다 (복붙 가능하게)
4. 에러가 발생했다면 "에러 → 원인 → 해결" 순서로 기록 (트러블슈팅 섹션)
5. 완료 후 `docs/00_index.md`와 `tasks.md`에도 체크 표시 반영
