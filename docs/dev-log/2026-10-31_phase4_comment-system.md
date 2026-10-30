# Phase 4: 댓글 시스템 (T068~T075)

> 관련 태스크: `T068`, `T069`, `T070`, `T070-S`, `T070-S2`, `T071`, `T072`, `T073`, `T074`, `T075`
> 작업일: 2026-10-31
> 결과물 위치:
> - DB: `backend/prisma/schema.prisma` (`Comment.guestPasswordHash`, `@@index([createdAt])`),
>   `backend/prisma/migrations/20261030233857_add_comment_guest_password/`
> - 백엔드: `backend/src/schemas/commentSchema.ts`, `backend/src/services/commentService.ts`,
>   `backend/src/controllers/commentController.ts`, `backend/src/routes/commentRoutes.ts`,
>   `backend/src/middlewares/commentRateLimiter.ts`, `backend/src/routes/{postRoutes,adminRoutes}.ts`, `backend/src/app.ts`
> - 프론트: `frontend/src/components/comment/{CommentSection,CommentList,CommentItem,CommentForm}.tsx`,
>   `frontend/src/hooks/useComments.ts`, `frontend/src/types/comment.ts`,
>   `frontend/src/app/admin/comments/page.tsx`, `frontend/src/components/admin/AdminCommentList.tsx`

---

## 1. 목표

게시글 아래에 댓글을 단다. 요구사항(`01_requirements_draft.md`, `02_tech_spec_detail.md`)에서
정리한 조건은 다음과 같다.

| 항목 | 정책 |
|---|---|
| 작성 | 로그인 유저 또는 **게스트(닉네임 + 간단 비밀번호)** |
| 구조 | 대댓글 (parentId self-relation 트리) |
| 삭제 | 본인 댓글만 (ADMIN 예외). 게스트는 작성 시 비밀번호로 |
| 스팸 방지 | 작성 10회/1분 (IP 기준) |
| XSS | 댓글 내용 sanitize |
| 정지 계정 | `SUSPENDED` 유저는 댓글 작성 차단 |
| 모더레이션 | 관리자 전체 댓글 조회/강제 삭제 |

---

## 2. DB 변경 — 게스트 비밀번호 컬럼 추가

Phase 1에서 만든 `Comment` 모델에는 `guestName`만 있고 **게스트 비밀번호를 저장할
곳이 없었다.** 기술명세(`POST /api/posts/:id/comments 🔒(선택적 게스트 허용 - 이름/비번)`)대로
게스트가 자기 댓글을 지우려면 비밀번호 해시가 필요하다.

```prisma
model Comment {
  // ...
  guestName         String? // 비로그인 댓글 허용 시
  guestPasswordHash String? // 게스트 댓글 삭제용 간단 비밀번호 (bcrypt 해시, API 응답에 절대 포함 금지)
  // ...
  @@index([postId])
  @@index([createdAt]) // 관리자 전체 댓글 목록(최신순) 조회용
}
```

클라우드 DB(Prisma Postgres)에 바로 적용하기 전에 `--create-only`로 SQL부터 확인했다.
nullable 컬럼 추가 + 인덱스뿐이라 기존 데이터에 영향이 없다.

```bash
cd backend
npx prisma format
npx prisma migrate dev --create-only --name add_comment_guest_password
cat prisma/migrations/*add_comment_guest_password/migration.sql
# -- AlterTable
# ALTER TABLE "comments" ADD COLUMN     "guestPasswordHash" TEXT;
# -- CreateIndex
# CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

npx prisma migrate deploy
npx prisma generate
npx prisma migrate status   # Database schema is up to date!
```

> 💡 bcrypt 라운드는 로그인 비밀번호(12)보다 낮은 **10**으로 했다. "삭제 확인용 간단
> 비밀번호"라 보호 대상의 가치가 낮고, 대신 무차별 대입은 Rate Limit으로 막는다(4-3).

---

## 3. 핵심 설계 결정과 코드

### 3-1. 트리 조회 (T068) — 한 번에 가져와서 메모리에서 조립

`parentId 재귀`를 DB 재귀 쿼리(CTE)나 Prisma의 중첩 `include`로 풀 수도 있지만,
Prisma `include`는 깊이를 미리 정해야 하고, 한 게시글의 댓글 수는 많아야 수백 개
수준이다. 그래서 **게시글의 댓글 전체를 한 번 조회해 `Map`으로 트리를 조립**했다
(쿼리 1회, 깊이 제한 없음).

```ts
// services/commentService.ts
const rows = await prisma.comment.findMany({
  where: { postId },                // ⚠️ 삭제된 댓글도 함께 가져온다
  orderBy: { createdAt: "asc" },
  select: COMMENT_SELECT,
});

const nodes = new Map(rows.map((row) => [row.id, toNode(row)]));
const roots: CommentNode[] = [];
for (const node of nodes.values()) {
  const parent = node.parentId ? nodes.get(node.parentId) : undefined;
  if (parent) parent.replies.push(node);
  else roots.push(node);
}
return { comments: pruneDeleted(roots), totalCount: rows.filter((r) => r.deletedAt === null).length };
```

**삭제된 댓글 처리**: 소프트 삭제된 댓글에 답글이 달려 있으면, 그 댓글을 빼버리면
답글들이 부모를 잃는다. 그래서

- 답글이 남은 삭제 댓글 → `isDeleted: true`, `content: ""`, `author: null`로 **자리만 유지**
  ("삭제된 댓글입니다")
- 답글이 없는(또는 답글도 전부 삭제된) 삭제 댓글 → 트리에서 **재귀적으로 제거**

```ts
function pruneDeleted(nodes: CommentNode[]): CommentNode[] {
  return nodes
    .map((node) => ({ ...node, replies: pruneDeleted(node.replies) }))
    .filter((node) => !node.isDeleted || node.replies.length > 0);
}
```

자식부터 먼저 정리한 뒤(`map`) 부모를 판단(`filter`)하므로, 마지막 답글이 지워지면
그 위의 "삭제된 댓글" 자리도 함께 사라진다.

### 3-2. 작성 (T069) — 회원/게스트 분기는 `optionalAuth`

이미 `authMiddleware.ts`에 "토큰이 있으면 `req.user`를 채우고, 없어도 통과"하는
`optionalAuth`가 있었다. 이걸로 한 라우트에서 회원/게스트를 분기한다.

```ts
// routes/postRoutes.ts
router.get("/:postId/comments", listComments);
router.post("/:postId/comments", commentRateLimiter, optionalAuth, createComment);
```

- **회원**: `userId`는 요청 바디가 아니라 `req.user.id`로 서버가 강제 설정한다
  (Zod 스키마에 `userId` 필드 자체가 없다 — CLAUDE.md 컨벤션). 그리고 **DB에서 계정
  상태를 다시 확인**한다. Access Token은 15분 동안 유효하므로, 그 사이에 정지된
  계정이 토큰만으로 댓글을 쓰는 걸 막기 위해서다.
- **게스트**: `guestName`, `guestPassword` 필수 → 비밀번호는 bcrypt 해시로만 저장.
  응답 select(`COMMENT_SELECT`)에 `guestPasswordHash`를 넣지 않아 **절대 응답으로
  나가지 않는다.**
- 답글이면 `parentId`가 **같은 게시글의 살아있는 댓글**인지 확인한다 (다른 글의
  댓글 id를 넣어 엉뚱한 곳에 답글이 붙는 것 방지).
- 비공개(DRAFT)/삭제된 게시글에는 조회·작성 모두 404.

### 3-3. 삭제 (T070) — 기존 `requireOwnership` 재사용

CLAUDE.md 규칙대로 소유권 검증은 새로 만들지 않고 `requireOwnership(getOwnerId)`를
재사용했다. 문제는 **게스트 댓글은 `userId`가 null**이라는 점이다.
`requireOwnership`은 `getOwnerId`가 `null`을 돌려주면 "리소스 없음(404)"으로 처리하므로,
그대로 두면 게스트 댓글을 **ADMIN조차 지울 수 없고**(404), 일반 유저에겐 "없는 댓글"이라는
틀린 메시지가 나간다.

```ts
/**
 * 게스트 댓글의 "소유자 ID" 자리에 들어가는 값.
 * requireOwnership은 null을 "리소스 없음(404)"으로 취급하므로, 게스트 댓글은 어떤 유저 id와도
 * 일치하지 않는 값을 돌려줘 일반 유저는 403, ADMIN은 예외 통과(모더레이션)하도록 만든다.
 */
const GUEST_OWNER_ID = "__guest__";

export async function getCommentOwnerId(commentId: string): Promise<string | null> {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: { userId: true },
  });
  if (!comment) return null;
  return comment.userId ?? GUEST_OWNER_ID;
}
```

| 요청자 | 회원 댓글 | 게스트 댓글 |
|---|---|---|
| 비로그인 | 401 | 401 → `guest-delete` 사용 |
| 다른 회원 | 403 | 403 |
| 작성자 본인 | 200 | — |
| ADMIN | 200 | 200 |

게스트는 로그인 토큰이 없으므로 별도 라우트로 비밀번호를 확인해 지운다.
`DELETE`에 바디를 싣는 방식은 일부 프록시/클라이언트가 바디를 버릴 수 있어 `POST`로 했다.

```ts
// routes/commentRoutes.ts
router.delete("/:id", requireAuth, requireOwnership((req) => getCommentOwnerId(req.params.id as string)), remove);
router.post("/:id/guest-delete", guestCommentDeleteRateLimiter, removeAsGuest);
```

회원 댓글에 `guest-delete`를 시도하면 403("회원 댓글은 로그인 후 삭제할 수 있습니다.")으로 막는다.

### 3-4. Rate Limit (T070-S)

```ts
// middlewares/commentRateLimiter.ts
export const commentRateLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, ... });

// 게스트 비밀번호는 4자 이상이면 되는 "간단 비밀번호"라 대입 공격에 특히 취약하다.
export const guestCommentDeleteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, ...
});
```

게스트 댓글이 가능하므로 계정이 아닌 **IP 기준**이다. 삭제 쪽은 기존
`loginRateLimiter`처럼 성공 요청은 카운트하지 않는다.

### 3-5. XSS (T070-S2) — 댓글은 "평문"으로 저장

게시글 본문은 TipTap HTML이라 허용 태그 목록을 두고 sanitize했지만, 댓글은 서식이
필요 없다. 그래서 **모든 태그를 제거하고 텍스트만 저장**한다. 프론트는 이 텍스트를
`dangerouslySetInnerHTML` 없이 `{comment.content}`로 렌더링하므로 React가 이스케이프한다
(서버 sanitize + 클라이언트 이스케이프 2중 방어).

```ts
function sanitizeCommentContent(text: string): string {
  const fragment = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: true,
  });
  return (fragment.textContent ?? "").trim();
}
```

왜 `RETURN_DOM_FRAGMENT`인지는 트러블슈팅 4-1 참고. 태그만 있던 댓글(`<script>x</script>`)은
sanitize 후 빈 문자열이 되어 400으로 거절한다. 게스트 닉네임도 같은 함수로 처리한다.

### 3-6. 프론트엔드 (T071~T073)

```
CommentSection (상세 페이지 하단, 클라이언트 조회)
├── CommentForm          ← 새 댓글
└── CommentList
    └── CommentItem      ← 재귀: replies를 다시 CommentItem으로
        └── CommentForm  ← "답글" 눌렀을 때 인라인
```

- **본문은 ISR, 댓글은 CSR**: 상세 페이지 본문은 60초 ISR 캐시지만, 댓글은 쓰자마자
  보여야 하므로 `useComments(postId)`(TanStack Query)로 따로 불러온다. 작성/삭제 후
  `["comments"]` 쿼리를 무효화한다. 기술명세의 `comments (CSR + mutate)`와 일치.
- **삭제 버튼 노출 규칙** (최종 판단은 백엔드): 회원 댓글은 작성자 본인·ADMIN에게만,
  게스트 댓글은 ADMIN에겐 바로 삭제, 그 외엔 비밀번호 입력칸. 비밀번호는
  `window.prompt`(입력값이 그대로 보임) 대신 `type="password"` 인라인 폼으로 받는다.
- **배지**: 게스트 댓글엔 "비회원", 글쓴이 본인 댓글엔 "작성자".
- **들여쓰기는 3단계까지**: 트리 깊이는 제한하지 않지만, 좁은 화면에서 본문이
  찌그러지지 않도록 4단계부터는 더 들여쓰지 않는다.
- **로딩 중 깜빡임 방지**: `useSession()`의 `status`가 `"loading"`일 때 `!== "authenticated"`로
  판단하면 로그인 유저에게도 잠깐 게스트 입력칸이 보인다. `=== "unauthenticated"`일
  때만 게스트로 취급하고, 로딩 중엔 등록 버튼을 비활성화했다.

### 3-7. 관리자 모더레이션 (T074, T075)

`GET /api/admin/comments`는 Phase 3-5의 관리자 게시글 목록처럼 Zod로 쿼리를 검증하고,
`q`로 **내용 · 게스트 닉네임 · 회원 닉네임**을 함께 검색한다. 어느 글의 댓글인지 바로
알 수 있도록 게시글 제목/slug와 작성자 이메일을 포함한다. 강제 삭제는
`DELETE /api/admin/comments/:id`(소유권 무관).

화면은 `PostFilterBar`에 `showStatusFilter` 옵션을 추가해 검색창만 재사용했다
(댓글엔 발행/임시저장 상태가 없음).

---

## 4. 트러블슈팅

### 4-1. DOMPurify가 `a < b`를 `a &lt; b`로 바꿔버림

**증상**: 서비스 코드를 쓰기 전에 sanitize 방식을 먼저 실험했다.

```bash
cd backend
node -e '
const DOMPurify=require("isomorphic-dompurify");
const f=(s)=>DOMPurify.sanitize(s,{ALLOWED_TAGS:[],ALLOWED_ATTR:[],RETURN_DOM_FRAGMENT:true}).textContent;
for (const s of ["a < b && c > d","<script>alert(1)</script>hi","<img src=x onerror=alert(1)>pic","<b>굵게</b> 텍스트","줄1\n줄2"]) console.log(JSON.stringify(s),"=>",JSON.stringify(f(s)));
console.log("plain sanitize:", JSON.stringify(DOMPurify.sanitize("a < b",{ALLOWED_TAGS:[]})));
'
# "a < b && c > d" => "a < b && c > d"
# "<script>alert(1)</script>hi" => "hi"
# "<img src=x onerror=alert(1)>pic" => "pic"
# "<b>굵게</b> 텍스트" => "굵게 텍스트"
# "줄1\n줄2" => "줄1\n줄2"
# plain sanitize: "a &lt; b"
```

**원인**: `DOMPurify.sanitize()`의 기본 반환값은 **HTML 문자열**이라, 텍스트 안의 `<`, `&`를
HTML 엔티티로 직렬화한다. 이 값을 평문으로 저장하면 React가 `&lt;`를 글자 그대로 보여줘
"a &lt; b"라는 깨진 댓글이 된다. 코드 질문이 많은 기술 블로그 댓글에서 `<`, `>`, `&&`는 흔하다.

**해결**: `RETURN_DOM_FRAGMENT: true`로 DOM을 받아 `textContent`(엔티티가 디코딩된 순수
텍스트)를 꺼낸다. 태그는 제거되고 일반 문자는 보존된다. 테스트에서
`'<script>alert(1)</script><img src=x onerror=alert(1)>안녕 a < b'` → `"안녕 a < b"` 확인.

### 4-2. `requireOwnership`이 게스트 댓글을 "없는 댓글(404)"로 처리

3-3 참고. 처음엔 `getCommentOwnerId`가 `comment.userId`를 그대로 반환하게 하려 했는데,
게스트 댓글은 `userId`가 `null`이라 `requireOwnership`의 "null = 404" 규칙에 걸린다.
`requireOwnership` 자체를 고치면 게시글 쪽 동작까지 바뀌므로, `getOwnerId`가 "존재하지만
누구의 것도 아님"을 뜻하는 값(`"__guest__"`)을 돌려주게 했다. cuid 형식이 아니라 실제
유저 id와 겹칠 수 없다.

### 4-3. 테스트가 이상하게 실패 — 지난 세션의 dev 서버가 포트를 잡고 있었음

**증상**: 백엔드를 다시 띄우고 테스트를 돌렸는데 회원가입이 바로 429가 났다.

```
Error: signup b: 429 {"success":false,"message":"회원가입 시도가 너무 많습니다. 1시간 후 다시 시도해주세요."}
```

Rate Limit은 메모리에 저장되니 새 서버라면 카운트가 0이어야 한다. 로그를 보니 새
서버는 시작하자마자 `[nodemon] clean exit`로 종료돼 있었다.

```bash
netstat -ano | grep -E ":4100 |:3000 " | grep LISTEN
#   TCP    0.0.0.0:3000   ...   LISTENING   4664
#   TCP    0.0.0.0:4100   ...   LISTENING   9668
```

**원인**: Phase 3-5 테스트 때 띄운 dev 서버를 멈출 때 `npm run dev`(nodemon)/`npx next dev`
**래퍼 프로세스만 종료되고, 그 자식인 실제 node 서버(ts-node, next start-server)는 살아남아
포트를 계속 점유**하고 있었다. 새 서버는 포트를 못 잡고 종료됐고, 테스트는 **댓글 라우트가
없는 옛날 코드**의 서버에 요청을 보내고 있었다 (회원가입 카운트도 그 서버에 쌓여 있었음).

**해결**: 포트 점유 PID의 실행 명령을 확인해 이 프로젝트 서버인 것을 확인한 뒤 종료했다.

```powershell
Get-CimInstance Win32_Process -Filter "ProcessId=9668 OR ProcessId=4664" | Select-Object ProcessId, CreationDate, CommandLine
Stop-Process -Id 9668,4664 -Force
```

이후 테스트가 끝날 때마다 `netstat`으로 포트가 비었는지까지 확인하도록 했다.
**교훈**: "서버를 껐다"는 래퍼가 꺼졌다는 뜻일 수 있다. 테스트 결과가 이상하면 내가 지금
**어떤 버전의 서버**에 요청하고 있는지부터 의심한다.

---

## 5. 테스트

### 5-1. 댓글 API (23/23 통과)

```
PASS  GET comments (empty) → 200, []
PASS  A(member) create → 201, author.type=user
PASS  guest without name/password → 400  — 비로그인 댓글은 닉네임과 비밀번호가 필요합니다.
PASS  guest create → 201, author.type=guest
PASS  guest response never includes password hash
PASS  XSS sanitize: tags stripped, '<' text kept (B reply)  — "안녕 a < b"
PASS  content that is only tags → 400 (empty after sanitize)
PASS  reply to non-existent parent → 400
PASS  DRAFT post: list/create → 404
PASS  GET tree: A's comment has B's reply nested, totalCount=3  — roots=2 total=3
PASS  anon DELETE member comment → 401
PASS  B DELETE A's comment → 403
PASS  B DELETE guest comment via member route → 403
PASS  guest-delete wrong password → 403  — 비밀번호가 일치하지 않습니다.
PASS  guest-delete on member comment → 403  — 회원 댓글은 로그인 후 삭제할 수 있습니다.
PASS  guest-delete correct password → 200
PASS  guest-delete already deleted → 404
PASS  A DELETE own comment → 200
PASS  deleted comment with live reply stays as placeholder (content/author hidden)
PASS  totalCount excludes deleted (=1)  — 1
PASS  after last reply deleted, placeholder pruned → []
PASS  USER → /api/admin/comments GET/DELETE → 403
PASS  comment rate limit → 429 within the minute  — after 4 extra requests
```

(Rate Limit은 같은 1분 안에 앞선 작성 요청 7건 + 4건 = 11번째에서 429 — 실패한 요청도
카운트된다.)

### 5-2. 관리자 기능 + 화면 (16/16 통과)

테스트용 ADMIN 계정이 없어서, 테스트 스크립트가 **방금 가입한 테스트 계정을 SQL로 임시
승격하고, `finally`에서 반드시 USER로 되돌리도록** 했다. (CLAUDE.md의 "관리자는 DB 직접
수정으로 승격" 운영 방식과 동일한 방법.)

```js
sql(`UPDATE "users" SET "role" = 'ADMIN' WHERE "email" = '${adminEmail}';`);   // npx prisma db execute --stdin
try { /* ...테스트... */ }
finally { sql(`UPDATE "users" SET "role" = 'USER' WHERE "email" = '${adminEmail}';`); }
```

```
PASS  ADMIN GET /api/admin/comments?q= → 200, both spam comments
PASS  admin row includes post + author email, no password hash
PASS  ADMIN search by guest name
PASS  ADMIN invalid limit → 400
PASS  ADMIN force-delete member comment → 200
PASS  ADMIN delete guest comment via member route (ownership ADMIN exception) → 200
PASS  post comments empty after moderation
PASS  [3-5] ADMIN GET /api/admin/posts?q=<author name> → finds post
PASS  [3-5] ADMIN unpublish other's post via PATCH /:id/status → DRAFT
PASS  [3-5] ADMIN GET /:id/edit (ownership exception) → 200
PASS  [3-5] ADMIN force-delete post → 200
PASS  post detail page renders comment section (T073)
PASS  ADMIN /admin/comments → 200 (T075)
PASS  [3-5] ADMIN /admin/posts → 200
PASS  USER /admin/comments → redirect /403
PASS  cleanup: temp admin demoted back to USER  — USER
```

`[3-5]` 항목은 Phase 3-5에서 ADMIN 계정이 없어 미검증으로 남겨뒀던 관리자 게시글
모더레이션이다 — 이번에 함께 확인했다.

### 5-3. 정적 검사/빌드

```bash
cd backend  && npx tsc -p tsconfig.json --noEmit           # 통과
cd frontend && npx next typegen && npx tsc --noEmit -p tsconfig.json   # 통과
cd frontend && npx eslint <변경 파일>                       # 에러/경고 0
cd frontend && npx next build                               # 성공 (/admin/comments ƒ 추가)
```

---

## 6. 남은 검증 항목

- [ ] 브라우저에서 댓글/답글 작성 → 목록 즉시 갱신 (TanStack Query 무효화)
- [ ] 게스트 댓글 비밀번호 삭제 인라인 폼 동작
- [ ] 다크모드에서 댓글 영역/배지 대비
- [ ] 실제 `SUSPENDED` 계정으로 댓글 작성 403 (회원 정지 API는 T082-S2에서 구현 예정 — 지금은 DB 직접 수정으로만 재현 가능)
- [ ] (요구사항 U8) "내 글에 달린 남의 댓글을 글쓴이가 삭제" — `tasks.md` T070 범위(본인 댓글만)를 따랐고 아직 미구현. 필요하면 `getCommentOwnerId` 대신 "댓글 작성자 또는 게시글 작성자"를 허용하는 검증이 필요

---

## 7. 배운 점

1. **라이브러리의 "기본 출력 형식"을 확인한다.** DOMPurify는 HTML 문자열을 돌려주는
   도구라, 평문 저장 용도로 쓰면 엔티티가 섞인다. 쓰기 전에 3줄짜리 실험으로 확인하는
   게 제일 빠르다.
2. **공용 미들웨어의 계약(contract)을 존중한다.** `requireOwnership`의 "null = 404" 규칙을
   바꾸는 대신, 호출하는 쪽(`getOwnerId`)이 의미에 맞는 값을 돌려주게 해서 기존 게시글
   동작을 건드리지 않았다.
3. **토큰은 "발급 당시"의 상태다.** 정지 같은 상태 변경은 토큰이 만료될 때까지 반영되지
   않으니, 중요한 쓰기 작업은 DB에서 현재 상태를 다시 확인한다.
4. **테스트 결과가 이상하면 환경부터.** 이번 429는 코드 버그가 아니라 살아남은 옛 서버였다.
