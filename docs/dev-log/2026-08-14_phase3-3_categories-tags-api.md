# Phase 3-3: 카테고리/태그 API (T053~T054)

> 관련 태스크: `T053`, `T054`
> 작업일: 2026-08-14
> 결과물 위치: `backend/src/{schemas/categorySchema.ts,services/categoryService.ts,controllers/categoryController.ts,routes/{categoryRoutes,tagRoutes}.ts}`, `adminRoutes.ts`, `app.ts`

## 1. 목표

게시글 CRUD(Phase 3-1)에서 이미 `categoryId`, `tags`를 입력받고 있었지만, 정작
카테고리 자체를 만들고 조회하는 API가 없었다. 이번 작업에서는:

- 카테고리 목록 조회는 **누구나** 가능 (공개)
- 카테고리 생성/수정/삭제는 **관리자 전용** (요구사항명세에 따라 카테고리 체계는
  사이트 운영자가 관리하는 영역으로 유지)
- 태그는 게시글 저장 시 자동 upsert(이미 구현됨)되므로, 이번엔 **조회 API만** 추가

를 구현한다.

---

## 2. 라우트 설계

```
GET    /api/categories              🔓 공개 — 전체 카테고리 목록
POST   /api/admin/categories        🛡️ 관리자 전용 — 생성
PATCH  /api/admin/categories/:id    🛡️ 관리자 전용 — 수정
DELETE /api/admin/categories/:id    🛡️ 관리자 전용 — 삭제

GET    /api/tags                    🔓 공개 — 전체 태그 목록 (게시글 수 많은 순)
```

카테고리 목록 조회는 일반 유저도 글쓰기 화면에서 카테고리를 선택해야 하므로
`/api/categories`(공개 경로)에 두고, 생성/수정/삭제만 `/api/admin/categories`
(기존 `adminRoutes.ts`)에 추가하는 방식으로 나눴다. 이렇게 하면 "조회는 누구나,
변경은 관리자만"이라는 규칙이 라우트 경로만 봐도 명확하게 드러난다.

---

## 3. 트러블슈팅: 한글 카테고리 이름의 slug가 빈 문자열이 되는 버그

카테고리 생성 API를 만들고 나서 `curl`로 `{"name": "개발"}`을 보내 테스트했는데,
응답의 `slug` 필드가 빈 문자열(`""`)로 나오는 문제를 발견했다.

```ts
// 문제가 있던 코드
function toSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, trim: true });
}
```

원인은 `slugify` 라이브러리의 `strict: true` 옵션이었다. 이 옵션은 URL에 안전하지
않은 문자를 "전부" 제거하는데, 기본 설정에서는 한글 같은 비-라틴 문자도
안전하지 않다고 판단해 통째로 삭제해버린다. 즉 `"개발"`처럼 순수 한글 이름은
제거할 문자만 남아서 결과가 빈 문자열이 되는 것이다.

더 심각한 건, 카테고리를 두 개 이상 한글 이름으로 만들면 **둘 다 빈 슬러그**가
되어 `@unique` 제약조건에 걸려 두 번째 카테고리부터 생성이 실패한다는 점이다.

### 해결

게시글 태그 slug 생성(`postService.ts`의 `upsertTags`)에서는 애초에 이 문제를
피하기 위해 `slugify`를 아예 쓰지 않고, 정규식으로 한글을 보존하는 방식을 쓰고
있었다. 카테고리도 같은 방식으로 통일했다.

```ts
function toSlug(value: string): string {
  const slugified = slugify(value, { lower: true, strict: true, trim: true });
  if (slugified) return slugified; // 영문 이름은 기존처럼 slugify 결과 사용

  // 한글 등 slugify가 전부 제거해버린 경우의 fallback
  const fallback = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-가-힣]/g, "");

  return fallback || "category";
}
```

영문 이름은 기존처럼 `slugify`의 결과를 그대로 쓰고, 결과가 빈 문자열일 때만
한글을 보존하는 fallback 로직으로 넘어가게 했다. 마지막 `|| "category"`는
이모지만 입력하는 등 fallback마저 빈 문자열이 되는 극단적인 경우를 위한
안전장치다.

---

## 4. 기능 테스트에서 겪은 또 다른 문제: 터미널 인코딩

수정 사항을 검증하려고 Windows Git Bash(MINGW64)에서 `curl -d '{"name":"개발"}'`
명령을 실행했는데, 서버에 실제로 도달한 데이터가 깨진 바이트였다(DB에 저장된
`name` 값도 `����` 형태로 깨져 있었음). 이건 애플리케이션 버그가 아니라 **쉘이
명령줄 인자의 한글 텍스트를 다른 인코딩으로 잘못 해석해서 curl에 넘기기 전에
이미 깨져버리는 환경 문제**였다.

이 문제를 우회하기 위해, curl 대신 Node.js의 `fetch()`로 직접 요청을 보내는
작은 스크립트를 임시로 작성해 테스트했다. Node 스크립트 안에서는 문자열 리터럴이
소스 파일의 UTF-8 인코딩 그대로 유지되므로 깨지지 않는다.

```js
const res = await fetch('http://localhost:4100/api/admin/categories', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ name: '여행' }),
});
```

이 방법으로 재검증한 결과, `name: "여행"`, `slug: "여행"`이 정상적으로 저장되는
것을 확인했다. (참고: 이 세션에서 이전에 curl로 만들었던 `"NextAuth테스트"` 같은
회원가입 테스트 데이터도 실은 같은 이유로 DB에 깨진 채 저장되어 있었을 가능성이
있다 — 실제 서비스 사용자는 브라우저를 통해 입력하므로 영향받지 않는다.)

---

## 5. 기능 테스트 결과

| 테스트 케이스 | 결과 |
|---|---|
| `POST /api/admin/categories` (한글 이름, 관리자 토큰) | 201, slug 정상 생성 |
| `PATCH /api/admin/categories/:id` (sortOrder 변경) | 200 |
| `GET /api/categories` (공개, 토큰 없이) | 200, 목록 반환 |
| `POST /api/admin/categories` (토큰 없이) | 401 |
| `DELETE /api/admin/categories/:id` | 200 |
| `GET /api/tags` (공개) | 200, 빈 배열(게시글에 태그가 없는 상태) |

---

## 6. 배운 점

- `slugify` 같은 라이브러리의 `strict` 모드는 "안전한 URL 문자만 남긴다"는
  뜻이지, "모든 언어를 지원한다"는 뜻이 아니다. 다국어(특히 한글) 서비스에서는
  결과가 빈 문자열이 되는 케이스를 반드시 가정하고 fallback을 준비해야 한다.
- 같은 프로젝트 안에서 "태그 slug 생성"과 "카테고리 slug 생성"처럼 유사한 로직이
  중복될 조짐이 보이면, 나중에 공통 유틸(`lib/slug.ts`)로 합치는 리팩터링을
  고려할 만하다 (지금은 각자 다른 소스에서 slug를 만들다 보니 규칙이 미묘하게
  달랐던 것이 이번 버그의 배경이기도 했다).
- 로컬 개발 환경(특히 Windows + Git Bash)에서 한글 등 비-ASCII 문자가 포함된
  API 요청을 curl로 테스트할 때는 쉘의 인코딩 문제를 의심해봐야 한다. 의심될
  때는 Node.js `fetch()`나 Postman처럼 소스 인코딩이 보장되는 도구로 우회
  검증하는 것이 안전하다.
