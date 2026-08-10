# CLAUDE.md

이 문서는 `lsh_blog` 프로젝트에서 Claude가 작업할 때 참고하는 지침입니다.
세션이 바뀌어도 아래 규칙을 그대로 따라야 합니다.

## 프로젝트 개요

- `frontend/`: Next.js 16 (App Router, TypeScript, Tailwind, shadcn/ui)
- `backend/`: Express 5 + TypeScript + Prisma 7 (Postgres)
- 진행 관리: [`tasks.md`](./tasks.md) — `T001`~`T101` 단위 태스크, `[ ]`/`[~]`/`[x]`로 상태 표시
- 문서: [`docs/`](./docs) — 요구사항/기술명세/DB/API/파이프라인/와이어프레임
- 작업 로그: [`docs/dev-log/`](./docs/dev-log) — 실제 진행한 개발 이력
- 블로그 원고: [`content/posts/`](./content/posts) — 초보자 친화적으로 재구성한 게시글

---

## 기능/Phase 단위 작업을 마쳤을 때 반드시 할 일

`tasks.md`의 한 절(예: "3-2. 이미지 업로드") 또는 굵은 기능 단위(로그인, 게시글
CRUD 등) 구현을 끝냈다면, 코드 변경 외에 아래 3가지를 **항상 함께** 처리한다.
(코드만 바꾸고 문서화를 빠뜨리지 않도록 매번 체크한다.)

1. **`tasks.md` 체크 표시** — 완료한 `T0XX` 항목을 `[x]`로 바꾸고, 무엇을
   어디에 구현했는지 한 줄 덧붙인다 (예: "— `lib/cloudinary.ts`, ... 구현").
2. **`docs/dev-log/YYYY-MM-DD_phaseX-Y_주제.md` 작성** — 실제로 진행한 내용을
   "왜 이 선택을 했는지" 근거와 함께 상세히 기록한다. 작성 후
   `docs/dev-log/README.md`의 표에 한 줄 추가한다.
3. **`content/posts/YYYY-MM-DD-build-my-blog-NN-주제.md` 작성** — dev-log를
   기반으로 초보자가 읽기 편하게 재구성한 블로그 원고를 만든다. 작성 후
   `content/posts/README.md`의 표에 한 줄 추가한다. `status: "DRAFT"`로 둔다
   (실제 발행은 관리자 페이지에서 수동으로).

날짜는 항상 오늘 날짜(YYYY-MM-DD)를 그대로 쓴다. 시리즈 번호(`NN`)는
`content/posts/README.md`의 마지막 항목 다음 번호를 잇는다.

### dev-log 문서 구조 (참고: [`docs/dev-log/2026-08-10_phase3-2_image-upload-cloudinary.md`](./docs/dev-log/2026-08-10_phase3-2_image-upload-cloudinary.md))

- 상단: 관련 태스크 번호, 작업일, 결과물 위치
- 목표 → 설치 패키지(표) → 핵심 설계 결정과 코드 → 트러블슈팅(에러→원인→해결)
  → 남은 검증 항목(체크리스트) → 배운 점
- 명령어/코드는 실제로 실행/작성한 그대로 남긴다 (복붙 가능하게)

### 블로그 원고 구조 (참고: [`content/posts/2026-08-10-build-my-blog-07-image-upload-cloudinary-multer.md`](./content/posts/2026-08-10-build-my-blog-07-image-upload-cloudinary-multer.md))

- YAML frontmatter: `title`, `slug`, `date`, `category`, `tags`, `status: "DRAFT"`, `summary`
- 이전 편 링크로 시작하는 인용구(`>`) 인트로 + "이 글에서 다루는 내용" 목록
- 전문 용어는 등장 직후 인용구나 괄호로 짧게 풀이
- "왜 이 방법을 선택했는가"를 반드시 설명 (단순 나열 금지)
- 실제 코드/명령어/에러와 해결 과정을 포함하는 트러블슈팅 섹션
- 글 마지막에 "다음 편 예고" 1~2문장

---

## `.env` / 시크릿 파일은 절대 직접 읽거나 쓰지 않는다

`backend/.env`, `backend/.env.example`, `frontend/.env.local` 등 `.env`류
파일은 권한 설정상 Claude가 접근할 수 없다 (의도된 설정). 새 환경변수가
필요해지면:

1. `validateEnv.ts`(백엔드) 등 **코드 쪽 검증 로직**은 자유롭게 수정한다.
2. 사용자에게 어떤 키를 어떤 파일에 추가해야 하는지 **정확한 키 이름과
   대상 파일 경로**를 알려주고, 값 채우기는 사용자에게 맡긴다.
3. 절대 우회 시도(다른 파일명으로 복사, Bash로 강제 접근 등)를 하지 않는다.

---

## 백엔드 코드 컨벤션 (반드시 따를 것)

- **경로 별칭**: `@/`는 `backend/src/`를 가리킨다 (import 시 상대경로 대신 사용).
- **에러 처리**: 모든 에러는 `AppError(message, statusCode)`를 던지고
  `next(err)`로 전달한다. 전역 `errorHandler`가 운영 환경에서 스택 트레이스를
  노출하지 않고 `{ success: false, message }` 형식으로 응답한다. 서드파티
  라이브러리(예: multer)가 자체 에러 타입을 던지면, 그 에러를 가로채
  `AppError`로 변환하는 래퍼를 만든다 (예: [`uploadMiddleware.ts`](./backend/src/middlewares/uploadMiddleware.ts)).
- **응답 형식**: 성공 시 `{ success: true, data: ... }` 또는
  `{ success: true, message: ... }`, 실패 시 `{ success: false, message: ... }`.
- **입력 검증**: Zod 스키마로 검증한다. `authorId`, `role`, `status` 등
  클라이언트가 절대 덮어쓰면 안 되는 필드는 **스키마 자체에 포함시키지
  않는다** — 서버가 `req.user.id`에서 강제로 채운다.
- **인증/인가 분리**:
  - `requireAuth`: 로그인 여부만 확인 (JWT 검증, `req.user` 채움)
  - `requireAdmin`: `role === "ADMIN"` 확인 (모더레이션 라우트 전용)
  - `requireOwnership(getOwnerId)`: 리소스 소유권 검증 팩토리 함수. 새 리소스
    타입에 소유권 검증이 필요하면 이 함수를 재사용한다 (새로 만들지 않는다).
- **파일 업로드**: 서버 디스크에 남길 필요가 없는 파일(예: 외부 스토리지로
  바로 전달)은 `multer.memoryStorage()` + 스트리밍 업로드를 쓴다. 디스크
  임시 파일 정리 로직이 필요한 경우에만 `diskStorage`를 고려한다.
- **보안 기본값**: 새 라우트를 추가할 때 다음을 항상 검토한다 — Rate
  Limiting 필요 여부, XSS(사용자 입력 HTML) sanitize 필요 여부, 소유권 검증
  필요 여부.

---

## 작업 완료 보고 시 확인할 것

- `npx tsc -p tsconfig.json --noEmit` (backend) 통과 확인
- 실제로 `.env` 값이 필요한 기능(외부 API 키 등)은 "코드는 구현했지만 값이
  없어 실제 호출 테스트는 못했다"는 상태를 숨기지 말고 명확히 알린다.
