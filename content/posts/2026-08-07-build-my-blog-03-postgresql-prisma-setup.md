---
title: "기술 블로그를 직접 만들어보자 #3 — Prisma로 데이터베이스 연결하기"
slug: "build-my-blog-03-postgresql-prisma-setup"
date: "2026-08-07"
category: "프로젝트 회고"
tags: ["Prisma", "PostgreSQL", "데이터베이스", "백엔드", "ORM"]
status: "DRAFT"
summary: "백엔드 서버에 실제 데이터베이스를 연결해보는 과정을 초보자 눈높이에서 정리했습니다. Prisma가 무엇인지, 마이그레이션이 뭔지, 그리고 Prisma 7의 새로운 '드라이버 어댑터' 개념까지 다룹니다."
---

# 기술 블로그를 직접 만들어보자 #3 — Prisma로 데이터베이스 연결하기

> [2편](./2026-08-07-build-my-blog-02-express-backend-security-middlewares.md)에서 Express 서버의
> 뼈대를 만들었다면, 이번 3편에서는 그 서버가 실제로 데이터를 저장할 수 있도록
> **데이터베이스(PostgreSQL)**를 연결해보겠습니다.

## 이 글에서 다루는 내용

1. 데이터베이스와 ORM이 뭔가요?
2. Prisma 설치하고 클라우드 DB 연결하기
3. `schema.prisma`로 테이블 설계하기
4. 마이그레이션이란?
5. Prisma 7의 새 개념: "드라이버 어댑터"
6. 서버가 DB에 잘 연결됐는지 확인하기

---

## 1. 데이터베이스와 ORM이 뭔가요?

지금까지 만든 Express 서버는 요청을 받고 응답만 보낼 뿐, 데이터를 어디에도 저장하지
않았습니다. 회원가입한 유저 정보나 작성한 게시글을 서버가 재시작해도 사라지지 않게
보관하려면 **데이터베이스**가 필요합니다. 이 프로젝트는 관계형 데이터베이스인
**PostgreSQL**을 사용합니다.

그런데 데이터베이스에 직접 SQL 문(`SELECT * FROM ...`)을 작성하는 건 번거롭고
실수하기 쉽습니다. 그래서 **ORM(Object-Relational Mapping)** 도구를 사용하는데,
이 프로젝트에서는 **Prisma**를 선택했습니다. Prisma를 쓰면 SQL 대신
`prisma.user.findMany()` 같은 TypeScript 코드로 데이터베이스를 다룰 수 있습니다.

---

## 2. 데이터베이스 서버 준비하기

로컬 컴퓨터에 PostgreSQL을 직접 설치할 수도 있지만, 이번에는 더 간단한 방법인
**Prisma Postgres**(Prisma에서 제공하는 클라우드 DB)를 사용했습니다.
몇 번의 클릭(또는 명령어) 만으로 인터넷 어딘가에 있는 PostgreSQL 서버를 발급받고,
연결 주소(연결 문자열)를 받을 수 있습니다.

```
DATABASE_URL="postgres://아이디:비밀번호@db.prisma.io:5432/postgres?sslmode=require"
```

이 값은 매우 민감한 정보(비밀번호 포함)이기 때문에, `.env` 파일에만 저장하고
`.gitignore`로 git에 올라가지 않도록 막아둡니다.

---

## 3. Prisma 설치하기

```bash
pnpm add -D prisma
pnpm add @prisma/client
```

- `prisma`: 마이그레이션, 스키마 생성 등을 도와주는 **CLI 도구** (개발할 때만 필요)
- `@prisma/client`: 실제 코드에서 데이터베이스를 조회/저장할 때 사용하는 **라이브러리**

> 💡 여기서 살짝 삽질이 있었습니다. `pnpm`은 보안 때문에 패키지 설치 후 자동 실행되는
> 스크립트(`postinstall`)를 기본적으로 막아두는데, Prisma는 이 스크립트로 필요한 실행 파일을
> 다운로드합니다. `package.json`에 아래처럼 허용 목록을 추가해줘야 정상 동작합니다.
>
> ```json
> "pnpm": { "onlyBuiltDependencies": ["@prisma/engines", "prisma"] }
> ```

---

## 4. `schema.prisma` — 테이블 설계도 작성하기

Prisma에서는 `schema.prisma`라는 파일 하나에 모든 테이블(모델) 구조를 적어둡니다.
예를 들어 회원(User) 테이블은 이렇게 생겼습니다.

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String
  name      String
  role      Role       @default(USER)
  status    UserStatus @default(ACTIVE)
  posts     Post[]
  createdAt DateTime   @default(now())
}

enum Role {
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  SUSPENDED
}
```

이 프로젝트는 원래 "관리자만 글을 쓸 수 있는 블로그"로 기획했다가, 중간에
"회원가입한 누구나 자기 글을 쓰고 수정/삭제할 수 있는 블로그"로 방향을 바꿨습니다.
그래서 `Post` 모델에는 어떤 회원이 쓴 글인지 표시하는 `authorId` 필드가 추가되었고,
계정을 정지시킬 수 있도록 `status` 필드도 추가했습니다.

---

## 5. 마이그레이션이란?

`schema.prisma` 파일은 어디까지나 "설계도"일 뿐, 이 자체로는 실제 데이터베이스에
아무 변화도 일어나지 않습니다. 설계도대로 **실제 테이블을 만들어주는 작업**이
바로 **마이그레이션**입니다.

```bash
npx prisma migrate dev --name init
```

이 명령을 실행하면:
1. `schema.prisma`와 실제 DB의 차이를 비교하고
2. 차이를 없애기 위한 SQL 파일을 `prisma/migrations/` 폴더에 자동 생성하고
3. 그 SQL을 실제 DB에 실행합니다

이렇게 만들어진 SQL 파일들은 git에 커밋해서 팀원들과 공유하거나, 배포 서버에도
동일하게 적용할 수 있습니다 — 마치 코드의 버전 관리처럼, 데이터베이스 구조도
버전 관리를 하는 셈입니다.

---

## 6. Prisma 7의 새 개념: "드라이버 어댑터"

이번에 설치한 Prisma 버전(7.9.1)은 최근에 나온 메이저 버전이라, 예전 튜토리얼과
다른 점이 꽤 있었습니다. 그중 가장 헷갈렸던 부분을 공유합니다.

### 문제: `PrismaClient`를 그냥 생성하면 에러가 난다

```ts
const prisma = new PrismaClient(); // ❌ 에러 발생!
```

```
PrismaClientInitializationError: PrismaClient was instantiated without any options.
A driver adapter is required.
```

Prisma 7부터는 어떤 데이터베이스를 쓰는지에 맞는 **"드라이버 어댑터"**를 직접 지정해야
합니다. PostgreSQL이라면 `@prisma/adapter-pg`를 사용합니다.

```bash
pnpm add @prisma/adapter-pg pg
```

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter }); // ✅ 정상 동작
```

또한 `.env`의 `DATABASE_URL`을 어디서 읽어올지도 예전에는 `schema.prisma` 안에
바로 적었지만, 이제는 `prisma.config.ts`라는 별도 설정 파일에 적습니다.

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: env("DATABASE_URL") },
});
```

---

## 7. 서버 재시작 시 커넥션이 계속 쌓이는 문제 방지하기

개발 중에는 코드를 수정할 때마다 서버가 자동으로 재시작(nodemon)됩니다.
그런데 매번 새로운 `PrismaClient`를 만들면, 이전 커넥션이 정리되지 않고 계속
쌓여서 결국 "커넥션이 너무 많습니다" 같은 에러가 날 수 있습니다.

그래서 개발 환경에서는 `PrismaClient` 인스턴스를 전역(global) 변수에 캐싱해두고,
이미 만들어진 게 있으면 재사용하도록 처리합니다. (Prisma 공식 문서에서 권장하는 패턴입니다.)

---

## 8. 잘 연결됐는지 확인하기

Express의 `/health` 엔드포인트에서 실제로 DB에 간단한 쿼리(`SELECT 1`)를 날려보고,
성공하면 "연결됨"이라고 응답하도록 만들었습니다.

```ts
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, message: "OK", db: "connected" });
  } catch {
    res.status(503).json({ success: false, message: "DB unavailable" });
  }
});
```

터미널에서 확인해보면:

```bash
$ curl.exe -s http://127.0.0.1:4100/health
{"success":true,"message":"OK","db":"connected"}
```

`db: "connected"`가 찍히면 서버와 데이터베이스가 정상적으로 연결된 것입니다. 🎉

---

## 마무리

이번 편에서는 데이터베이스를 왜 쓰는지부터, Prisma로 테이블을 설계하고
마이그레이션하는 방법, 그리고 최신 Prisma 버전에서 새로 등장한 드라이버 어댑터
개념까지 다뤄봤습니다. 다음 편에서는 이 데이터베이스를 활용해 **실제 회원가입/로그인
기능**을 구현해보겠습니다.
