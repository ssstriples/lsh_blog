/**
 * 모든 AI 프롬프트가 공유하는 "이 프로젝트에 대한 사실" 블록.
 * 시스템 프롬프트 맨 앞에 두고 cache_control을 붙이므로, 요청마다 바뀌는 값(날짜, 사용자 입력 등)을
 * 여기에 넣으면 캐시가 깨진다 — 반드시 고정된 내용만 둔다.
 */
export const PROJECT_CONTEXT = `<project>
lsh_blog — 누구나 회원가입 후 글을 쓸 수 있는 멀티 유저 기술 블로그. 관리자(ADMIN)는 모더레이션과 회원 관리만 한다.

기술 스택
- 프론트엔드: Next.js 16 (App Router, TypeScript, Tailwind CSS, shadcn/ui), NextAuth v5 (Credentials → 백엔드 JWT), TanStack Query(서버 상태), Zustand(브라우저 임시저장), TipTap v3 에디터, Shiki 코드 하이라이팅, Recharts
- 백엔드: Express 5 + TypeScript, Prisma 7 (PostgreSQL), Zod 4 입력 검증, JWT(Access 15분 + Refresh 7일 HttpOnly 쿠키), Cloudinary 이미지 업로드
- 주요 모델: User(role ADMIN/USER, status ACTIVE/SUSPENDED), Post(slug, status DRAFT/PUBLISHED, authorId, 소프트 삭제), Category, Tag/PostTag, Comment(parentId 트리, 게스트 댓글), PostView, PostLike

백엔드 컨벤션
- 폴더: routes / controllers / services / schemas / middlewares / lib, import는 "@/" 경로 별칭
- 에러는 AppError(message, statusCode)를 던지고 전역 errorHandler가 { success: false, message }로 응답. 성공은 { success: true, data }
- 인증/인가: requireAuth(로그인), requireAdmin(관리자), requireOwnership(getOwnerId)(본인 리소스, ADMIN 예외), requireActiveUser(정지 계정 쓰기 차단)
- authorId·role·status처럼 클라이언트가 덮어쓰면 안 되는 필드는 Zod 스키마에 넣지 않고 서버가 req.user.id 등으로 채운다
- 새 라우트마다 Rate Limit / XSS sanitize(DOMPurify) / 소유권 검증 필요 여부를 검토한다
- API 표의 인증 표기: 🔓 공개, 🔒 로그인, 🔑 본인(ADMIN 예외), 🛡️ 관리자 전용

문서 관례
- 작업 단위는 tasks.md의 T0XX 태스크(1~4시간 크기), 진행 로그는 docs/dev-log/, 블로그 원고는 content/posts/
- 문서와 글은 한국어로 쓴다
</project>`;
