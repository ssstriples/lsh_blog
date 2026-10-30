# Phase 3-5: 게시글 작성/수정 프론트엔드 (T062~T067-S)

> 관련 태스크: `T062`, `T063`, `T064`, `T065`, `T066`, `T067`, `T067-S`
> 작업일: 2026-10-31
> 결과물 위치:
> - 에디터/폼: `frontend/src/components/write/{RichTextEditor,EditorToolbar,PostEditor,TagInput,ThumbnailUploader}.tsx`
> - 페이지: `frontend/src/app/posts/new/page.tsx`, `frontend/src/app/posts/[slug]/edit/page.tsx`,
>   `frontend/src/app/my/posts/page.tsx`, `frontend/src/app/admin/posts/page.tsx`
> - 목록 UI: `frontend/src/components/post/{MyPostList,PostStatusBadge}.tsx`,
>   `frontend/src/components/admin/AdminPostList.tsx`, `frontend/src/components/common/PostFilterBar.tsx`
> - 상태/훅: `frontend/src/store/draftStore.ts`, `frontend/src/hooks/{usePostMutations,useAdminPosts,useMyPosts}.ts`
> - 유틸: `frontend/src/lib/{uploadImage,queryString,formatDate,parseStatusParam}.ts`,
>   `frontend/src/lib/actions/revalidatePost.ts`
> - 백엔드: `backend/src/schemas/postSchema.ts`, `backend/src/services/postService.ts`,
>   `backend/src/controllers/postController.ts`, `backend/src/routes/postRoutes.ts`

---

## 1. 목표

Phase 3-4까지는 게시글을 **보여주기만** 했다. 이번 Phase에서는 로그인한
유저 누구나 글을 **쓰고, 고치고, 임시저장하고, 발행/비공개 전환하고,
지울 수 있는** 화면을 만든다. 관리자는 글을 직접 쓰지 않고, 모더레이션
화면에서 부적절한 글을 비공개 전환하거나 강제 삭제만 한다.

| 경로 | 권한 | 내용 |
|---|---|---|
| `/posts/new` | 🔒 로그인 | 새 글 작성 |
| `/posts/[id]/edit` | 🔑 작성자 본인 (ADMIN 예외) | 글 수정, 타인 → `/403` |
| `/my/posts` | 🔒 로그인 | 내가 쓴 글 (검색/상태 필터/상태 배지) |
| `/admin/posts` | 🛡️ ADMIN | 전체 글 모더레이션 (비공개 전환/강제 삭제) |

> `tasks.md`의 T062는 "onggi-shop 기반 이식"이었지만, onggi-shop 소스가 이
> 머신에 없어서(`D:\LSH_GITHUB` 아래에 없음) TipTap v3 API 기준으로 새로
> 작성했다. 툴바 구성은 와이어프레임(`docs/06_pages_wireframe.md`)의
> "B I U H1 H2 코드 표 이미지"를 기준으로 잡았다.

---

## 2. 설치한 패키지

```bash
# frontend/
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extensions \
  @tiptap/extension-image @tiptap/extension-table @tiptap/extension-text-align \
  @tiptap/extension-code-block-lowlight lowlight zustand
```

| 패키지 | 버전 | 역할 |
|---|---|---|
| `@tiptap/react`, `@tiptap/pm` | 3.32.2 | TipTap 에디터 React 바인딩 + ProseMirror 코어 |
| `@tiptap/starter-kit` | 3.32.2 | 문단/헤딩/목록/인용/굵게/기울임/**밑줄·링크**(v3부터 포함)/실행취소 등 기본 묶음 |
| `@tiptap/extensions` | 3.32.2 | `Placeholder` (v3에서 개별 패키지 → 이 묶음으로 이동) |
| `@tiptap/extension-image` | 3.32.2 | 본문 이미지 |
| `@tiptap/extension-table` | 3.32.2 | `TableKit` (table/row/header/cell 한 번에) |
| `@tiptap/extension-text-align` | 3.32.2 | 좌/중/우 정렬 |
| `@tiptap/extension-code-block-lowlight` + `lowlight` | 3.32.2 / 3.3.0 | 에디터 안 코드 블록 문법 하이라이팅 (기술명세 `02_tech_spec_detail.md`에 명시된 확장) |
| `zustand` | 5.0.16 | localStorage 자동저장 (`persist` 미들웨어) |

TipTap v3에서 바뀐 점(설치 후 `node_modules/@tiptap/*/dist/index.d.ts`로
직접 확인):

- `Underline`, `Link`가 StarterKit에 포함됨 → 따로 설치하지 않고 `StarterKit.configure({ link: {...} })`로 설정
- `Placeholder`는 `@tiptap/extensions`에서 named export
- 표는 `TableKit` 하나로 4개 노드를 등록
- `useEditor`에 `immediatelyRender` 옵션 — SSR 환경에서는 `false` 필수

---

## 3. 핵심 설계 결정과 코드

### 3-1. 에디터: 활성 상태만 구독하는 툴바 (`useEditorState`)

이 프로젝트는 `next.config.ts`에서 **React Compiler**(`reactCompiler: true`)를
켜 두었다. TipTap의 `editor` 객체는 같은 인스턴스가 내부적으로 계속
바뀌는(mutable) 객체라, `editor.isActive("bold")`를 렌더 중에 직접 읽으면
컴파일러가 "값이 안 바뀌었다"고 판단해 툴바 버튼 상태가 갱신되지 않을 수
있다. 그래서 TipTap이 제공하는 `useEditorState`로 **필요한 값만 뽑아
구독**하게 했다. 덤으로 키 입력마다 툴바 전체가 다시 렌더링되지도 않는다.

```tsx
// components/write/EditorToolbar.tsx
const state = useEditorState({
  editor,
  selector: ({ editor: e }) => ({
    bold: e.isActive("bold"),
    h2: e.isActive("heading", { level: 2 }),
    codeBlock: e.isActive("codeBlock"),
    codeLanguage: (e.getAttributes("codeBlock").language as string | undefined) ?? "plaintext",
    table: e.isActive("table"),
    canUndo: e.can().undo(),
    // ...
  }),
});
```

커서가 코드 블록/표 안에 있을 때만 보조 툴바(코드 언어 `<select>`, 행/열
추가·삭제)가 나타난다. 언어 목록은 상세 페이지의 Shiki가 로드하는 언어
(`lib/renderPostContent.ts`)와 **똑같이** 맞췄다 — 에디터에서 고를 수 있는데
발행 화면에선 하이라이팅이 안 되는 언어가 없도록.

### 3-2. 에디터 출력 HTML ↔ 상세 페이지 렌더러 호환성 확인

Phase 3-4에서 `renderPostContent.ts`는 코드 블록이
`<pre><code class="language-xxx">` 형태라고 **가정**하고 정규식을 짰다.
실제 TipTap이 그렇게 내보내는지 설치된 소스를 직접 확인했다.

```js
// @tiptap/extension-code-block/dist/index.js
renderHTML({ node, HTMLAttributes }) {
  return ["pre", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ["code", { class: node.attrs.language ? this.options.languageClassPrefix + node.attrs.language : null }, 0]];
}
```

`languageClassPrefix` 기본값이 `"language-"`이고, `defaultLanguage: "plaintext"`로
설정해 class가 항상 붙도록 했다. 에디터 안의 lowlight 하이라이팅은
ProseMirror **decoration**이라 `getHTML()` 결과에는 `hljs-*` span이 섞이지
않는다 → 저장되는 HTML은 깨끗하고, 발행 화면에선 Shiki가 다시 칠한다.

### 3-3. 수정 페이지 라우트: `/posts/[slug]/edit` 폴더에 id를 받는 이유

와이어프레임 URL은 `/posts/[id]/edit`이지만, 이미 `/posts/[slug]`(상세)가
있다. Next.js는 **같은 위치의 동적 세그먼트 이름이 서로 다른 것**
(`[slug]`와 `[id]`)을 허용하지 않으므로, 폴더는 `[slug]`를 공유하고 그
값을 id로 해석한다. URL은 의도대로 `/posts/<id>/edit`이다 (`PostOwnerActions`가
이미 이 주소로 링크하고 있었음).

```tsx
// app/posts/[slug]/edit/page.tsx
export default async function EditPostPage(props: PageProps<"/posts/[slug]/edit">) {
  const { slug: postId } = await props.params;   // ⚠️ 실제로는 게시글 id
  const session = await auth();
  if (!session?.user || session.error) redirect(`/login?callbackUrl=...`);

  let post: PostDetail;
  try {
    post = await apiFetch<PostDetail>(`/api/posts/${postId}/edit`, {
      accessToken: session.accessToken,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect(`/login?callbackUrl=...`);
      if (err.status === 403) redirect("/403");
      if (err.status === 404) notFound();
    }
    throw err;
  }
  return <PostEditor post={post} />;
}
```

**왜 서버 컴포넌트에서 검증하나?** 클라이언트에서 불러온 뒤 "본인이 아니면
튕겨내기"를 하면, 잠깐이라도 남의 DRAFT 원고가 화면/네트워크 응답에
실린다. 서버에서 백엔드 응답 코드를 보고 바로 `redirect("/403")`하면 남의
글 내용이 브라우저까지 오지 않는다. 그리고 "본인 글인가"는 프론트가 아니라
**백엔드 `requireOwnership`이 판정**한다 — 프론트는 결과(403)만 해석한다.

이를 위해 백엔드에 새 라우트를 열었다. 기존 `GET /api/posts/:slug`는
PUBLISHED만 반환하고 조회수도 올리므로 수정 화면용으로 쓸 수 없다.
`detailById` 컨트롤러와 `getPostById` 서비스는 이미 있었지만 라우트에
연결돼 있지 않았다.

```ts
// backend/src/routes/postRoutes.ts
// 수정 화면 진입용 조회 — DRAFT도 내려주므로 반드시 소유권 검증 뒤에 둔다
router.get("/:id/edit", requireAuth, ownershipCheck, detailById);
```

`proxy.ts`에도 `/posts/new`, `/posts/:id/edit`를 추가해 비로그인 사용자는
페이지 렌더링 전에 `/login?callbackUrl=`로 보낸다.

### 3-4. 자동저장(T066): 서버 "임시저장"과 브라우저 "자동저장"은 다르다

두 개념을 분리했다.

| | 브라우저 자동저장 | 서버 임시저장 |
|---|---|---|
| 저장 위치 | localStorage (Zustand `persist`) | DB (`status: DRAFT`) |
| 트리거 | 30초마다, 바뀐 게 있을 때만 | "임시저장" 버튼 |
| 목적 | 탭이 닫히거나 브라우저가 죽어도 원고 보존 | 다른 기기에서 이어쓰기, 마이페이지 노출 |

```ts
// store/draftStore.ts
export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({ drafts: {}, saveDraft: ..., clearDraft: ... }),
    {
      name: "lsh-blog-post-drafts",
      storage: createJSONStorage(() => localStorage),
      // SSR 단계에는 localStorage가 없다 — 클라이언트 마운트 후 rehydrate()를 직접 호출한다.
      skipHydration: true,
    },
  ),
);
```

- **키 설계**: `${userId}:new` / `${userId}:${postId}` — 한 브라우저를 여러
  계정이 써도 남의 원고가 복원 배너에 뜨지 않는다. 새 글 원고와 수정 중
  원고도 서로 덮어쓰지 않는다.
- **`skipHydration` + 수동 `rehydrate()`**: Next.js는 서버에서도 컴포넌트를
  렌더링하는데 서버에는 localStorage가 없다. 마운트 후(`useEffect`)에
  직접 불러와야 hydration 불일치가 없다.
- **rehydrate 전 저장 금지(`hydratedRef`)**: 불러오기가 끝나기 전에
  `saveDraft`가 실행되면, 아직 빈 `{}` 상태에 키 하나만 넣은 객체로
  localStorage 전체를 덮어써 **다른 글의 원고가 지워진다**. 그래서 타이머는
  hydrate 완료 플래그를 확인한 뒤에만 저장한다.
- **변경분만 저장**: 직전 저장 내용과 `JSON.stringify` 스냅샷을 비교해 같으면
  건너뛴다 — 가만히 있는 탭이 "방금 저장됨"을 계속 갱신하지 않도록.
- **복원 UX**: 재진입 시 저장된 원고가 서버 내용과 다르면 "저장하지 않은
  원고가 있습니다 (N분 전 자동저장) [불러오기] [버리기]" 배너. 불러오기는
  폼 state를 바꾸고 에디터 `key`를 올려 **다시 마운트**한다 (TipTap의
  `content`는 최초 1회만 반영되는 uncontrolled 방식이라).
- 서버 저장(임시저장/발행)에 성공하면 로컬 원고는 삭제한다.

### 3-5. 저장 버튼과 상태 전환 (T067)

| 현재 서버 상태 | 버튼 |
|---|---|
| 새 글 / DRAFT | [임시저장] [발행하기] |
| PUBLISHED | [비공개로 저장] [수정 내용 발행] |
| (수정 화면) | + [삭제] |

- 새 글을 **임시저장**하면 `router.replace("/posts/<id>/edit")`로 이동한다.
  그대로 `/posts/new`에 머물면 다음 저장이 또 `POST`가 되어 같은 글이
  여러 개 생기기 때문.
- **발행**하면 상세 페이지(`/posts/<slug>`)로 이동한다.
- 슬러그는 비워두면 서버가 제목으로 생성하고, 수정 시 비우면 기존 값을
  유지한다(요청에서 아예 빼서 보냄).

### 3-6. 저장 후 캐시 2종 무효화: TanStack Query + ISR

상세 페이지는 Phase 3-4에서 **ISR(60초)** 로 만들었다. 글을 고치고 발행해도
최대 60초 동안 옛 내용이 보이는 문제가 생긴다. 그래서 저장/상태전환/삭제
성공 시 Server Action으로 `revalidatePath`를 호출한다.

```ts
// lib/actions/revalidatePost.ts
"use server";
const SLUG_PATTERN = /^[a-z0-9-]{1,200}$/;

export async function revalidatePostPages(slugs: string[]): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  for (const slug of new Set(slugs)) {
    if (SLUG_PATTERN.test(slug)) revalidatePath(`/posts/${slug}`);
  }
}
```

Server Action은 결국 **누구나 POST할 수 있는 공개 엔드포인트**라서
로그인 여부와 slug 형식을 검증한다 (비로그인 사용자가 캐시를 마구 비우는
것을 막는 최소 방어). slug를 바꿔 저장한 경우 **이전 slug 페이지도** 함께
무효화한다(`previousSlug`).

```ts
// hooks/usePostMutations.ts
function useInvalidatePosts() {
  const queryClient = useQueryClient();
  return async (slugs: string[]) => {
    await revalidatePostPages(slugs);
    await Promise.all(
      ["posts", "post", "myPosts", "adminPosts", "tags"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
}
```

`PostOwnerActions`(상세 페이지 삭제 버튼)도 이 공용 `useDeletePost`로 바꿔
삭제 시 ISR 캐시가 함께 지워지게 했다.

### 3-7. 마이페이지/모더레이션 목록: 필터는 URL에

`/my/posts?q=...&status=DRAFT&page=2` 처럼 검색어/상태/페이지를 모두 URL
쿼리로 관리한다. 새로고침·뒤로가기·링크 공유에도 필터가 유지되고, 기존
`app/page.tsx`의 "서버 컴포넌트에서 `searchParams` 파싱 → 클라이언트
목록에 props 전달" 패턴과도 일치한다. `Pagination`에는 다른 쿼리를 유지하는
`query` prop을 추가했다.

백엔드는 공개 목록용 `listPostsQuerySchema`와 별도로 관리용 스키마를 만들었다
(공개 목록은 항상 PUBLISHED라 status 필터가 의미 없으므로 섞지 않음).

```ts
// backend/src/schemas/postSchema.ts
export const managePostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().trim().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});
```

`GET /api/admin/posts`는 원래 컨트롤러 안에서 `Number(req.query.page)`로
검증 없이 Prisma를 직접 호출하고 있었다(`?page=abc` → `NaN`). 이번에
위 스키마로 검증하고 `postService.listAllPostsForAdmin`으로 옮겼으며,
`q`는 **제목 또는 작성자 닉네임**을 검색한다 (와이어프레임의 "작성자 필터").

관리자의 "비공개 전환"은 새 API를 만들지 않고 `PATCH /api/posts/:id/status`를
재사용했다. `requireOwnership`이 ADMIN을 예외 통과시키므로 그대로 동작한다.

### 3-8. 이미지 업로드: FormData일 때 Content-Type 비우기

`apiFetch`는 항상 `Content-Type: application/json`을 붙였다. multipart
업로드에서 이 헤더를 직접 지정하면 **boundary가 빠져** 서버(multer)가 바디를
못 읽는다. body가 `FormData`면 헤더를 생략해 브라우저가 boundary를 채우게 했다.

```ts
const isFormData = typeof FormData !== "undefined" && rest.body instanceof FormData;
headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), ... }
```

`lib/uploadImage.ts`는 백엔드와 같은 제한(5MB, jpeg/png/webp/gif)을
업로드 전에 미리 검사해 불필요한 요청을 줄인다. 최종 검증은 여전히 서버
몫이다. 필드명 `"image"`는 백엔드 `multer().single("image")`와 맞춰야 한다.

### 3-9. 소소한 정리

- `toQueryString`(훅 2곳), `formatDate`(컴포넌트 2곳)가 복붙돼 있던 것을 세 번째
  사용처가 생기기 전에 `lib/queryString.ts`, `lib/formatDate.ts`로 추출했다.
- 태그 입력은 Enter/쉼표로 추가, 빈 입력에서 Backspace로 마지막 태그 삭제,
  기존 태그는 `<datalist>`로 자동완성. **한글 IME 조합 중 Enter**
  (`e.nativeEvent.isComposing`)는 무시해야 마지막 글자가 중복 입력되지 않는다.

---

## 4. 트러블슈팅

### 4-1. 🐛 제목만 수정해도 발행글이 비공개로 바뀌는 백엔드 버그 (Zod 4)

**증상(발견 경위)**: 수정 화면을 만들기 전에 `PATCH /api/posts/:id`의 스키마를
보다가 의심이 들어 직접 확인했다.

```ts
export const createPostSchema = z.object({
  // ...
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
});
export const updatePostSchema = createPostSchema.partial();
```

```bash
cd backend
node -e "
const {z}=require('zod');
const s=z.object({status:z.enum(['DRAFT','PUBLISHED']).optional().default('DRAFT'), t:z.string().optional()}).partial();
console.log(JSON.stringify(s.parse({t:'a'})));
"
# {"status":"DRAFT","t":"a"}
```

**원인**: 백엔드는 Zod **4**(`^4.4.3`)를 쓴다. `.partial()`은 필드를 optional로
감쌀 뿐, 안쪽의 `.default("DRAFT")`는 그대로 살아 있어서 값이 없으면 기본값이
채워진다. 그러면 `updatePost`가 `input.status !== undefined`로 판단해
**status를 DRAFT로 덮어쓴다**. 즉 `{ title: "오타 수정" }`만 보내도 발행된 글이
비공개가 된다. (Phase 3-1 당시에는 수정 화면이 없어 드러나지 않았다.)

**해결**: 수정 스키마에서는 status를 default 없이 다시 정의했다.

```ts
export const updatePostSchema = createPostSchema
  .extend({ status: z.enum(["DRAFT", "PUBLISHED"]) })
  .partial();
```

프론트의 `PostEditor`는 어차피 status를 항상 명시해서 보내지만, API를 직접
호출하는 다른 경로(나중의 AI 파이프라인 등)를 위해 서버 쪽을 고치는 게 맞다.
테스트: 발행 글 생성 → `{ title }`만 PATCH → `status=PUBLISHED` 유지 확인.

### 4-2. `Pagination`의 `query` prop 이름 충돌

```
Block-scoped variable 'query' used before its declaration. (ts 2448)
```

**원인**: 새로 추가한 prop 이름 `query`가 `hrefFor` 안의 기존 지역 변수
`const query = search.toString()`과 같은 이름이라, 함수 스코프 안에서
`query`가 아직 선언 전인 지역 변수를 가리켰다(TDZ).
**해결**: 구조 분해 시 `query: extraQuery = {}`로 이름을 바꿔 받았다.

### 4-3. (사전 회피) 동적 세그먼트 이름 충돌

`app/posts/[id]/edit`를 만들면 기존 `app/posts/[slug]`와 같은 위치에 서로
다른 이름의 동적 세그먼트가 생겨 Next.js가 라우트 생성을 거부한다. 처음부터
`[slug]/edit`에 두고 코드 주석으로 "값은 id"임을 명시했다 (3-3 참고).

### 4-4. ESLint `no-unused-vars` — 구조 분해로 키 제거

`const { [key]: _removed, ...rest } = state.drafts`는 프로젝트 ESLint 설정에서
`_` 접두사도 경고가 났다. 복사본을 만든 뒤 `delete drafts[key]`로 바꿨다.

---

## 5. 테스트

Node `fetch` 스크립트로 백엔드 API와 프론트 화면 접근 제어를 확인했다
(Phase 3-3에서처럼 터미널 한글 인코딩 문제를 피하려고 curl 대신 Node 사용).

**백엔드 API (17/17 통과)**

```
PASS  A: create PUBLISHED post → 201
PASS  A: PATCH title only keeps status PUBLISHED (Zod4 partial/default fix)
PASS  A(owner): GET /:id/edit → 200 with content
PASS  B(other): GET /:id/edit → 403  — 본인이 작성한 콘텐츠만 수정/삭제할 수 있습니다.
PASS  anon: GET /:id/edit → 401
PASS  A: GET /:id/edit unknown id → 404
PASS  A: DRAFT readable via /:id/edit
PASS  anon: DRAFT hidden from public /:slug → 404
PASS  A: /users/me/posts?status=DRAFT returns only drafts
PASS  A: /users/me/posts?q= title search
PASS  A: invalid status filter → 400
PASS  A: PATCH /:id/status → DRAFT
PASS  B: PATCH other's post → 403
PASS  A(USER): GET /api/admin/posts → 403
PASS  A: DELETE … → 200  (×2)
PASS  A: deleted post /:id/edit → 404
```

**프론트 화면 — NextAuth 세션 쿠키로 로그인 후 요청 (9/9 통과)**

`/api/auth/csrf` → `/api/auth/callback/credentials`로 세션 쿠키를 받은 뒤
`redirect: "manual"`로 각 페이지를 요청했다.

```
PASS  NextAuth session cookie issued
PASS  anon /posts/new → redirect /login  — /login?callbackUrl=%2Fposts%2Fnew
PASS  anon /posts/:id/edit → redirect /login
PASS  A /posts/new → 200 (editor page)
PASS  A(owner) /posts/:id/edit → 200 with title prefilled
PASS  B(other) /posts/:id/edit → redirect /403  — 307 /403
PASS  A /posts/<unknown>/edit → 404  — 404
PASS  A /my/posts → 200
PASS  A(USER) /admin/posts → redirect /403
```

**정적 검사/빌드**

```bash
cd backend  && npx tsc -p tsconfig.json --noEmit   # 통과
cd frontend && npx next typegen && npx tsc --noEmit -p tsconfig.json   # 통과
cd frontend && npx eslint <변경 파일>               # 에러 0
cd frontend && npx next build                       # 성공 (/posts/new ○, /posts/[slug]/edit ƒ, /my/posts ƒ, /admin/posts ƒ)
```

> 새 라우트를 만든 직후에는 `PageProps<"/posts/[slug]/edit">` 타입이 아직
> 생성되지 않아 tsc가 `does not satisfy the constraint 'AppRoutes'` 에러를 낸다.
> `npx next typegen`(또는 `next dev` 실행)으로 라우트 타입을 다시 만들면 해결된다.

---

## 6. 남은 검증 항목

브라우저 자동화 도구 없이 진행해서, **실제 브라우저 상호작용은 확인하지 못했다.**

- [ ] 에디터 툴바 각 버튼(헤딩/목록/코드블록 언어 변경/표 행·열 편집/정렬/링크) 동작
- [ ] 본문 이미지·썸네일 업로드 → Cloudinary URL 삽입 (`CLOUDINARY_*` 값이 필요)
- [ ] 30초 자동저장 → 탭 닫고 재진입 시 "불러오기/버리기" 배너 → 복원
- [ ] 새 글 임시저장 → `/posts/<id>/edit`로 이동, 다시 저장해도 글이 중복 생성되지 않음
- [ ] 발행글 수정 → 상세 페이지에 60초 기다리지 않고 즉시 반영 (Server Action `revalidatePath`)
- [ ] 다크모드에서 에디터 코드 블록(lowlight) 색상 대비
- [x] ADMIN 계정으로 `/admin/posts` 비공개 전환/강제삭제 — Phase 4 작업 중 테스트 계정을 임시 ADMIN으로 승격해 API(검색/비공개 전환/강제삭제/`/:id/edit`)와 `/admin/posts` 화면 200 확인 (`2026-10-31_phase4_comment-system.md` 참고)
- [ ] 헤더의 "관리자" 메뉴는 아직 없는 `/admin`(T081 대시보드)으로 연결됨 — T081에서 해결 예정

---

## 7. 배운 점

1. **라이브러리 메이저 버전이 바뀌면 "당연한" 동작도 다시 확인한다.** Zod 3에서
   안전하던 `.partial()` + `.default()` 조합이 Zod 4에서는 조용히 데이터를
   바꾸는 버그가 됐다. 에러가 안 나는 버그가 제일 무섭다.
2. **이전 Phase의 가정을 실제 출력으로 검증한다.** 3-4의 렌더러가 가정한 HTML
   구조를 TipTap 소스(`renderHTML`)로 직접 확인하고 나서야 안심할 수 있었다.
3. **권한 판정은 백엔드, 프론트는 해석만.** 수정 페이지는 서버 컴포넌트에서
   백엔드 응답 코드(401/403/404)를 그대로 redirect/notFound로 바꾸기만 한다.
4. **캐시가 두 겹이면 무효화도 두 번.** 클라이언트 캐시(TanStack Query)와 서버
   캐시(ISR)를 함께 비워야 "저장했는데 안 바뀌었어요"가 안 생긴다.
5. **localStorage 상태는 hydration 타이밍이 핵심.** 불러오기 전에 쓰면 덮어쓴다.
