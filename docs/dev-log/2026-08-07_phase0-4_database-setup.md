# Phase 0-4 & Phase 1: 데이터베이스 세팅 + 스키마 설계 (T014~T028)

> 관련 태스크: `T014`, `T015`, `T016`, `T017`, `T021`~`T028`
> 작업일: 2026-08-07
> 결과물 위치: `backend/prisma/`, `backend/src/lib/prisma.ts`, `backend/prisma.config.ts`

## 1. 목표

Prisma ORM을 이용해 PostgreSQL 데이터베이스를 연결하고, `docs/03_db_schema_erd.md`(2차 개정 —
다중 사용자 소유권 모델)에 정의된 전체 스키마(User/Category/Tag/Post/PostTag/Comment/PostView/PostLike)를
작성 및 마이그레이션한다.

---

## 2. T014 — 클라우드 PostgreSQL(Prisma Postgres) 생성

로컬에 PostgreSQL/Docker가 준비되어 있지 않아, Prisma에서 공식 제공하는
**Prisma Postgres**(관리형 클라우드 DB)를 사용하기로 했습니다.

- 프로젝트명: `lsh_blog`
- 리전: `ap-northeast-1` (도쿄 — 한국에서 지연 시간이 가장 짧은 리전)
- 발급된 연결 문자열을 `backend/.env`의 `DATABASE_URL`에 저장

```
DATABASE_URL="postgres://<user>:<password>@db.prisma.io:5432/postgres?sslmode=require"
```

> ⚠️ `.env`는 `.gitignore`에 포함되어 있어 git에 커밋되지 않습니다. 실제 값은 로컬에만 존재합니다.

---

## 3. T015 — Prisma 설치

```bash
pnpm add -D prisma
pnpm add @prisma/client
```

설치된 버전은 `prisma@7.9.1`입니다. **Prisma 7은 이전 메이저 버전과 비교해 설정 방식이 크게 바뀐
버전**이라, 아래에서 겪은 문제들이 대부분 이 버전 차이에서 발생했습니다.

### pnpm이 postinstall 스크립트를 차단하는 문제

pnpm은 보안을 위해 기본적으로 패키지의 `postinstall` 스크립트 실행을 차단합니다.
Prisma의 엔진 바이너리 다운로드가 `postinstall`에서 이루어지기 때문에, 이를 명시적으로
허용해줘야 합니다.

`backend/package.json`:
```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["@prisma/engines", "prisma"]
  }
}
```

`backend/.npmrc`:
```
enable-pre-post-scripts=true
```

이후 `pnpm rebuild prisma @prisma/engines`로 강제 재실행하여 엔진 바이너리를 받았습니다.

---

## 4. T016 — Prisma 7의 새로운 설정 방식: `prisma.config.ts`

기존(Prisma 6 이하)에는 `schema.prisma`의 `datasource` 블록에 직접 `url = env("DATABASE_URL")`을
적었지만, **Prisma 7부터는 이 방식이 제거**되고 별도의 `prisma.config.ts` 파일에서
데이터소스 URL을 지정하도록 강제됩니다. (`prisma migrate`/`generate` 실행 시 `P1012` 오류로 안내)

`backend/prisma.config.ts`:
```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
```

`schema.prisma`의 datasource 블록은 provider만 남기면 됩니다:
```prisma
datasource db {
  provider = "postgresql"
}
```

---

## 5. T017, T021~T026 — 스키마 작성 (`schema.prisma`)

`docs/03_db_schema_erd.md`(2차 개정판)에 정의된 모델을 그대로 옮겼습니다.
2차 개정의 핵심은 **"관리자만 글을 쓸 수 있다"에서 "로그인한 누구나 자기 글을 CRUD할 수 있다"**로
바뀐 것이고, 이에 따라 아래 필드들이 추가/변경되었습니다.

| 모델 | 추가/변경된 필드 | 이유 |
|---|---|---|
| `User` | `role: Role @default(USER)` | 기본값이 `USER`. `ADMIN`은 시드/수동 승격으로만 생성 |
| `User` | `status: UserStatus @default(ACTIVE)` | 계정 정지(`SUSPENDED`) 상태 관리용 |
| `Post` | `authorId` + `@@index([authorId])` | 게시글 소유자 식별 및 "마이페이지" 조회 성능 |
| `Comment` | `userId` (nullable) | 로그인 사용자의 댓글 소유권 (비로그인 게스트 댓글과 공존) |

Enum 정의:
```prisma
enum Role {
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}

enum PostStatus {
  DRAFT
  PUBLISHED
}
```

`PostView`, `PostLike` 모델은 조회수/좋아요 어뷰징 방지를 위해 (postId, 식별자) 조합에
유니크 제약을 걸어, 동일 사용자/IP가 중복으로 카운트를 올리지 못하도록 설계했습니다.

---

## 6. T027 — 마이그레이션 실행

```bash
npx prisma migrate dev --name init
```

결과: `prisma/migrations/20260807072414_init/`에 마이그레이션 SQL 생성, 클라우드 DB에
실제 테이블 생성 완료 (`Your database is now in sync with your schema.`)

## 7. T028 — Prisma Client 생성

```bash
npx prisma generate
```

---

## 8. 트러블슈팅: "드라이버 어댑터가 필요합니다" 오류

`PrismaClient`를 기존 방식대로 옵션 없이 생성하니 다음 오류가 발생했습니다:

```
PrismaClientInitializationError: PrismaClient was instantiated without any options.
A driver adapter is required.
```

**Prisma 7부터는 데이터베이스별 "드라이버 어댑터"를 직접 지정해야 합니다.**
PostgreSQL의 경우 `@prisma/adapter-pg`와 `pg` 패키지가 필요합니다.

```bash
pnpm add @prisma/adapter-pg pg
pnpm add -D @types/pg
```

`backend/src/lib/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = global.__prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
```

개발 모드에서 `global` 객체에 캐싱하는 이유: `nodemon`이 코드 변경 시마다 서버를 재시작하는데,
매번 새 `PrismaClient` 인스턴스를 만들면 DB 커넥션이 누적되어 결국 커넥션 풀이 고갈됩니다.

---

## 9. `/health` 엔드포인트에 DB 연결 확인 추가

`app.ts`의 헬스체크를 비동기로 바꾸고, 실제로 DB에 쿼리를 날려 연결 상태를 확인하도록 했습니다.

```ts
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: "OK", db: "connected" });
  } catch (err) {
    logger.error("DB health check failed", err);
    res.status(503).json({ success: false, message: "DB unavailable" });
  }
});
```

검증 결과:
```bash
$ curl.exe -s http://127.0.0.1:4100/health
{"success":true,"message":"OK","db":"connected"}
```

---

## 10. 환경변수 검증에 `DATABASE_URL` 추가

`validateEnv.ts`의 `REQUIRED_ENV_VARS` 배열에 `DATABASE_URL`을 추가하여,
서버 시작 시 값이 없으면 즉시 fail-fast 하도록 했습니다.

---

## 11. 배운 점

- Prisma 7은 `prisma.config.ts` + 드라이버 어댑터 필수라는 큰 변화가 있다. 공식 문서
  (`pris.ly/d/config-datasource`, `pris.ly/d/driver-adapters`)를 먼저 확인하는 게 시간을 절약한다.
- pnpm의 `onlyBuiltDependencies`는 보안 기본값이지만, Prisma처럼 postinstall이 필수인
  패키지는 명시적으로 예외 처리를 해줘야 한다.
- 클라우드 DB(Prisma Postgres)는 로컬 Docker 설치 없이도 바로 개발을 시작할 수 있어 편리하다.
