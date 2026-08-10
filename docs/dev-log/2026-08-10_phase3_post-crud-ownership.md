# Phase 3: 게시글 CRUD + 소유권 검증 (T045~T050-S5)

> 관련 태스크: `T045`~`T050`, `T050-S`~`T050-S5`
> 작업일: 2026-08-10
> 결과물 위치: `backend/src/{schemas,services,controllers,middlewares,routes}/*post*`, `userRoutes.ts`, `adminRoutes.ts`

## 1. 목표

Phase 2에서 만든 인증 시스템을 기반으로, **로그인한 모든 유저가 자신의 게시글을
생성/수정/삭제할 수 있는 CRUD API**를 구현한다. 핵심은 "본인 글만 수정/삭제
가능"이라는 **소유권 검증(Ownership Authorization)**을 재사용 가능한 형태로
설계하는 것이다.

---

## 2. 설치한 패키지

```bash
pnpm add isomorphic-dompurify slugify
```

| 패키지 | 역할 |
|---|---|
| `isomorphic-dompurify` | 서버(Node.js) 환경에서도 동작하는 DOMPurify — 게시글 본문 HTML의 XSS 위험 요소 제거 |
| `slugify` | 게시글 제목으로부터 URL-safe한 slug 문자열 생성 |

---

## 3. 핵심 설계: 재사용 가능한 소유권 검증 미들웨어

Phase 2에서 예고했던 `ownershipMiddleware.ts`를 여기서 구현했다. 게시글뿐 아니라
나중에 댓글(Phase 4)에서도 동일한 패턴("본인 것만 수정/삭제, ADMIN 예외")이
필요하므로, **리소스 종류에 상관없이 재사용 가능한 팩토리 함수**로 만들었다.

```ts
// backend/src/middlewares/ownershipMiddleware.ts
export function requireOwnership(
  getOwnerId: (req: Request) => Promise<string | null>,
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError("로그인이 필요합니다.", 401);

    const ownerId = await getOwnerId(req);
    if (ownerId === null) throw new AppError("요청하신 리소스를 찾을 수 없습니다.", 404);

    const isOwner = ownerId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new AppError("본인이 작성한 콘텐츠만 수정/삭제할 수 있습니다.", 403);
    }
    next();
  };
}
```

게시글 라우트에서는 이렇게 사용한다:

```ts
// backend/src/routes/postRoutes.ts
const ownershipCheck = requireOwnership((req) => getPostAuthorId(req.params.id as string));

router.patch("/:id", requireAuth, ownershipCheck, update);
router.patch("/:id/status", requireAuth, ownershipCheck, updateStatus);
router.delete("/:id", requireAuth, ownershipCheck, remove);
```

`getPostAuthorId`는 게시글의 `authorId`만 가볍게 조회하는 서비스 함수다. 이 패턴 덕분에
나중에 댓글에 소유권 검증을 붙일 때는 `requireOwnership((req) => getCommentUserId(req.params.id))`
한 줄만 추가하면 된다.

---

## 4. T045 — 게시글 생성: `authorId`는 절대 클라이언트가 지정할 수 없다

이 프로젝트의 가장 중요한 보안 원칙 중 하나: **게시글의 소유자(authorId)는
요청 바디에서 절대 받지 않는다.** 만약 클라이언트가 `authorId`를 body에 넣어
보낼 수 있다면, 다른 사람 명의로 글을 작성하는 공격이 가능해진다.

```ts
// backend/src/schemas/postSchema.ts — authorId 필드 자체가 스키마에 없다
export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1),
  // ...authorId는 여기 없음
});
```

```ts
// backend/src/controllers/postController.ts
export async function create(req: Request, res: Response, next: NextFunction) {
  const input = parseOrThrow(createPostSchema, req.body);
  const post = await createPost(req.user!.id, input); // ⚠️ req.user.id — JWT에서 검증된 값만 사용
  res.status(201).json({ success: true, data: post });
}
```

### slug 자동 생성

제목을 넣으면 자동으로 URL-safe한 slug를 만들어준다. 충돌하면 랜덤 접미사를 붙인다.

```ts
export async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title, { lower: true, strict: true, trim: true }) || "post";
  let candidate = base;
  while (/* 최대 20번 */) {
    const existing = await prisma.post.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
```

---

## 5. T050-S — XSS 방지: DOMPurify sanitize

TipTap 에디터가 만든 HTML을 그대로 저장하면, 악의적인 사용자가 `<script>` 태그나
`onerror` 속성 등을 삽입해 다른 사용자의 브라우저에서 스크립트를 실행시킬 수 있다
(저장형 XSS). 그래서 저장 전에 반드시 sanitize 처리를 한다.

```ts
function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"], // 임베드용 (유튜브 등)
    ADD_ATTR: ["target", "rel", "class", "data-language"], // Shiki 코드 하이라이팅용 속성
  });
}
```

실제 테스트:
```bash
# 요청
{"content": "<p>hi <script>alert(1)</script></p>"}

# 저장 후 조회 결과
{"content": "<p>hi </p>"}   # <script> 태그가 제거됨
```

---

## 6. T050 — 상세 조회 + 조회수 증가 (중복 방지)

`PostView` 모델의 `@@unique([postId, ipHash])` 제약을 활용해, 동일 IP가
같은 글을 여러 번 봐도 조회수가 한 번만 오르도록 만들었다.

```ts
const ipHash = hashIp(clientIp); // IP를 그대로 저장하지 않고 SHA-256 해시로 저장 (개인정보 보호)
try {
  await prisma.postView.create({ data: { postId: post.id, ipHash } });
  await prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });
} catch {
  // 이미 조회한 적 있는 IP — 유니크 제약 위반 에러를 조용히 무시
}
```

---

## 7. T050-S2~S5 — 마이페이지 / 공개 프로필 / 관리자 모더레이션

| 엔드포인트 | 인증 | 설명 |
|---|---|---|
| `GET /api/users/me/posts` | 🔒 로그인 | 내가 쓴 글 (DRAFT 포함) — 마이페이지용 |
| `GET /api/users/:id/posts` | 🔓 공개 | 특정 작성자의 PUBLISHED 글만 — 공개 프로필용 |
| `GET /api/admin/posts` | 🛡️ 관리자 | 전체 게시글 (다른 유저 글 포함, DRAFT 포함) — 모더레이션 |
| `DELETE /api/admin/posts/:id` | 🛡️ 관리자 | 소유권 무관 강제 삭제 — 스팸/악성 콘텐츠 대응 |

관리자 라우트(`adminRoutes.ts`)는 `ownershipCheck`를 전혀 사용하지 않고
`requireAdmin`만 사용한다는 점이 핵심 차이다 — 관리자는 "본인 글인지"와 무관하게
모든 글에 접근할 수 있어야 하기 때문이다.

---

## 8. 통합 테스트: 소유권 검증 시나리오

두 명의 유저(Alice, Bob)를 만들어 실제로 검증했다.

```bash
# 1. Alice가 글 작성 (XSS 포함)
POST /api/posts (Alice 토큰) → 201, content의 <script>는 자동 제거됨

# 2. Bob이 Alice의 글 수정 시도
PATCH /api/posts/:id (Bob 토큰) → 403 "본인이 작성한 콘텐츠만 수정/삭제할 수 있습니다."

# 3. Bob이 Alice의 글 삭제 시도
DELETE /api/posts/:id (Bob 토큰) → 403

# 4. Alice가 자신의 글 수정
PATCH /api/posts/:id (Alice 토큰) → 200

# 5. 인증 없이 글 생성 시도
POST /api/posts (토큰 없음) → 401

# 6. 마이페이지 조회 (Alice)
GET /api/users/me/posts (Alice 토큰) → 200, Alice가 쓴 글 목록 반환

# 7. Alice가 자신의 글 삭제
DELETE /api/posts/:id (Alice 토큰) → 200
```

모든 케이스가 예상대로 동작함을 확인했다.

---

## 9. Express 5의 사소하지만 중요한 타입 이슈

Express 5에서는 `req.params.id`의 타입이 `string | string[]`이다 (예전 Express 4는
항상 `string`이었다). 라우트 패턴에 따라 배열이 될 수 있는 여지를 열어둔 것인데,
실제로는 단일 파라미터라면 항상 문자열이 온다. 타입 단언 대신 작은 헬퍼로 처리했다:

```ts
function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}
```

---

## 10. 배운 점

- 소유권 검증 로직은 리소스마다 다르게 짜지 않고, **"소유자 ID를 조회하는 함수"만
  주입받는 팩토리 패턴**으로 만들면 댓글 등 다른 리소스에도 그대로 재사용할 수 있다.
- 사용자 입력으로 절대 덮어써서는 안 되는 필드(`authorId`, `role`, `status` 등)는
  **애초에 Zod 스키마에 포함시키지 않는 것**이 "실수로 덮어쓰기"를 원천 차단하는
  가장 확실한 방법이다.
- 게시글 본문처럼 사용자가 HTML을 직접 입력/편집하는 기능에는 저장 시점의
  서버사이드 sanitize가 필수다 (클라이언트 sanitize만 믿으면 API를 직접 호출하는
  공격을 막을 수 없다).
