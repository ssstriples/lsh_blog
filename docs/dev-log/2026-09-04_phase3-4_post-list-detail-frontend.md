# Phase 3-4: 게시글 목록/상세 프론트엔드 (T055~T061)

> 관련 태스크: `T055`, `T056`, `T057`, `T057-S`, `T058`, `T059`, `T060`, `T061`
> 작업일: 2026-09-04
> 결과물 위치: `frontend/src/hooks/{usePosts,usePost,useMyPosts,useCategories,useTags}.ts`,
> `frontend/src/components/post/`, `frontend/src/components/common/Pagination.tsx`,
> `frontend/src/lib/renderPostContent.ts`, `frontend/src/app/{page.tsx,category/[slug],tag/[slug],users/[id],posts/[slug]}`

## 0. 작업 전 발견한 문제 — `frontend/`가 `docs/frontend/`로 이동돼 있었음

작업을 시작하기 전 `git status`를 확인했더니 `frontend/` 아래 모든 파일이
삭제된 것으로 표시됐다. 실제로는 파일이 사라진 게 아니라, 디렉토리 자체가
`docs/frontend/`로 옮겨져 있었다 (`package.json`의 `name: "frontend"`,
`node_modules`, `.next` 등 실제 프로젝트 그대로). git이 추적하지 않는 문서
폴더 밑으로 프로젝트가 들어가 있었던 것이라 원래 위치(`frontend/`)로
되돌린 뒤 작업을 시작했다. 원인은 특정되지 않았지만(수동 이동 추정),
다시 발생하면 `git status`에서 대량 삭제가 보일 때 바로 `mv` 대상을
의심해볼 수 있도록 기록해둔다.

---

## 1. 목표

목록(홈/카테고리/태그/작성자 프로필)과 상세 페이지를 만든다. 백엔드는
Phase 3-1~3-3에서 이미 다 준비돼 있으므로(`GET /api/posts`,
`GET /api/posts/:slug`, `GET /api/users/:id/posts` 등), 이번 편은 순수
프론트엔드 작업이다.

---

## 2. 설치한 패키지

```bash
# frontend/
pnpm add @tanstack/react-query
pnpm add isomorphic-dompurify shiki
pnpm add -D @tailwindcss/typography
```

| 패키지 | 역할 |
|---|---|
| `@tanstack/react-query` | 클라이언트 사이드 데이터 fetching/캐싱 (목록 페이지들) |
| `isomorphic-dompurify` | 게시글 상세 렌더링 시 서버(백엔드)와 동일한 방식으로 재sanitize (2중 방어) |
| `shiki` | 코드 블록 문법 하이라이팅 (라이트/다크 듀얼 테마) |
| `@tailwindcss/typography` | 게시글 본문(HTML)에 `prose` 클래스로 타이포그래피 스타일 적용 |

> **실수 기록**: `@tanstack/react-query`를 처음 설치할 때 셸이 이전 명령의
> `cd backend`를 그대로 물고 있어서 `backend/package.json`에 잘못
> 설치됐다. `pwd`로 확인하지 않고 연속 명령을 내리면 이런 실수가 난다는
> 걸 다시 확인했다 — 이후 디렉토리를 넘나드는 작업은 매번 `pwd`로
> 확인하는 습관을 들였다.

---

## 3. 목록 페이지들 — 클라이언트 사이드 fetching (TanStack Query)

홈(`/`), 카테고리(`/category/[slug]`), 태그(`/tag/[slug]`), 작성자
프로필(`/users/[id]`) 4개 페이지가 전부 "페이지네이션 가능한 게시글
그리드"라는 같은 모양이라, 하나의 `PostGrid` 컴포넌트로 통일했다.

```tsx
// frontend/src/components/post/PostGrid.tsx
interface PostGridProps extends Omit<ListPostsParams, "page" | "limit"> {
  page: number;
  basePath: string; // 페이지네이션 링크 basePath (예: "/", "/category/tech")
}

export function PostGrid({ page, basePath, ...filters }: PostGridProps) {
  const { data, isPending, isError } = usePosts({ ...filters, page, limit: PAGE_SIZE });
  // ...로딩/에러/빈 상태 → 그리드 + Pagination
}
```

카테고리/태그 이름 표시는 별도의 회원/카테고리 상세 API가 없어서, 전체
목록을 가져오는 `useCategories`/`useTags`에서 slug로 찾아 헤딩에 쓴다.
작성자 프로필(`/users/[id]`)은 회원 정보 API 자체가 없어서, 더 실용적인
방법을 택했다 — 어차피 같은 로직인 `GET /api/posts?authorId=`(=
`GET /api/users/:id/posts`)로 글 목록을 가져오면 각 글에 작성자 닉네임이
이미 포함돼 있으므로, 그 첫 글의 `author.name`을 헤딩으로 재사용했다.

```tsx
// frontend/src/components/post/UserPostList.tsx
const { data } = usePosts({ authorId: userId, page: 1, limit: 1 });
const authorName = data?.posts[0]?.author.name;
```

이렇게 하면 "회원 상세 조회" API를 새로 만들지 않고도 닉네임을 보여줄 수
있다. 다만 그 작성자의 글이 하나도 없으면 이름을 알 방법이 없어서
"작성자 프로필"이라는 fallback 문구를 쓴다 — 이 프로젝트 범위에서는
감수할 수 있는 트레이드오프로 판단했다.

라우트는 Next.js 16의 `PageProps<'경로'>` 헬퍼(타입 자동 생성)를 써서
`params`/`searchParams`를 타입 안전하게 받는다.

```tsx
// frontend/src/app/category/[slug]/page.tsx
export default async function CategoryPage(props: PageProps<"/category/[slug]">) {
  const { slug } = await props.params;
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  return <CategoryPostList slug={slug} page={page} />;
}
```

---

## 4. 상세 페이지 — 왜 클라이언트 fetching이 아니라 ISR(서버 렌더링)을 택했나

목록 페이지들은 전부 TanStack Query로 클라이언트에서 가져오는데, 상세
페이지(`/posts/[slug]`)만 다르게 만들었다. `T058`이 명시적으로 "ISR
적용"을 요구했고, ISR(Incremental Static Regeneration)은 애초에
**서버에서 렌더링되는 페이지**에만 적용되는 Next.js 기능이라 클라이언트
훅으로는 구현할 수 없다. 그래서 상세 페이지는 `async` Server Component로
만들고, 백엔드 API를 서버에서 직접 호출한다.

```tsx
// frontend/src/app/posts/[slug]/page.tsx
export const revalidate = 60; // 60초마다 재검증, 그 사이엔 캐시된 페이지 제공

async function getPost(slug: string) {
  try {
    return await apiFetch<PostDetail>(`/api/posts/${slug}`, { next: { revalidate } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export default async function PostDetailPage(props: PageProps<"/posts/[slug]">) {
  const { slug } = await props.params;
  const post = await getPost(slug);
  if (!post) notFound();
  const { html, toc } = await renderPostContent(post.content);
  // ...
}
```

기존에 만들어둔 `apiFetch` 헬퍼(T055에서 작성)를 그대로 재사용할 수
있었다 — Next.js가 전역 `fetch`의 `RequestInit`에 `next: { revalidate }`
옵션을 타입 레벨로 확장해두기 때문에, 별도 수정 없이 옵션만 얹으면
됐다.

ISR을 쓰면 조회수 증가(백엔드가 `GET /api/posts/:slug`를 호출할 때마다
증가시킴)도 재검증 주기(60초)에 묶인다는 부수 효과가 있다 — 즉 같은
60초 창 안에서는 실제 방문자 수만큼 조회수가 늘지 않을 수 있다. 이
프로젝트 단계에서는 성능/캐싱 이득이 더 크다고 보고 그대로 두기로
했다. 정확한 조회수가 중요해지면 조회수 카운트만 별도 API로 분리하는
방향을 고려할 수 있다 (지금은 범위 밖).

### 소유권 검증 버튼은 왜 서버가 아니라 클라이언트에서 판단하나

수정/삭제 버튼은 "글쓴이 본인 또는 ADMIN"에게만 보여야 한다. 서버
컴포넌트에서 NextAuth의 `auth()`로 세션을 확인하는 방법도 있었지만, 이미
`Header` 컴포넌트(Phase 2-3)가 클라이언트에서 `useSession()`으로 로그인
상태를 판단하는 패턴을 쓰고 있었다. 같은 프로젝트 안에서 "인증 상태를
어디서 판단하는가"가 두 가지 방식으로 나뉘면 헷갈리기 쉬우므로, 기존
패턴을 그대로 따라 `PostOwnerActions`도 클라이언트 컴포넌트로 만들고
`useSession()`을 썼다.

```tsx
// frontend/src/components/post/PostOwnerActions.tsx
const { data: session } = useSession();
const canManage = session?.user && (session.user.id === authorId || session.user.role === "ADMIN");
if (!canManage) return null;
```

---

## 5. 본문 렌더링 파이프라인 — sanitize → 헤딩 id/TOC 추출 → Shiki 하이라이팅

`T059`~`T061`은 사실 하나의 파이프라인이라, `lib/renderPostContent.ts`
하나에 순서대로 구현했다.

1. **재sanitize**: 백엔드가 이미 `isomorphic-dompurify`로 sanitize한
   HTML을 DB에 저장하지만(Phase 3-1), 프론트엔드에서 한 번 더 같은
   옵션으로 sanitize했다. 저장된 데이터가 나중에 다른 경로(마이그레이션,
   관리자 직접 수정 등)로 오염될 가능성에 대한 2중 방어다.
2. **헤딩 id 부여 + TOC 추출**: 정규식으로 `<h1>~<h6>`을 찾아 각각 id를
   부여하고, 그 목록을 목차 데이터로 함께 뽑아낸다. id는 백엔드
   태그/카테고리 slug 생성 로직과 동일하게 **한글을 보존**하도록 만들었다
   (`slugify`가 한글을 지워버리는 문제를 Phase 3-3에서 이미 겪었기
   때문에, 같은 실수를 반복하지 않도록 처음부터 한글 보존 방식을 썼다).

   ```ts
   function slugifyHeading(text: string, index: number): string {
     const base = text.trim().toLowerCase()
       .replace(/\s+/g, "-")
       .replace(/[^a-z0-9-가-힣]/g, "");
     return base ? `${base}-${index}` : `heading-${index}`;
   }
   ```

   같은 텍스트의 헤딩이 여러 번 나와도 겹치지 않도록 등장 순서 `index`를
   접미사로 붙인다.

3. **Shiki 코드 하이라이팅**: TipTap 에디터가 만드는
   `<pre><code class="language-xxx">...</code></pre>` 블록을 정규식으로
   찾아서, HTML 엔티티(`&lt;` 등)를 원문 코드로 되돌린 뒤 Shiki
   `codeToHtml`로 하이라이팅된 마크업으로 교체한다.

   ```ts
   const highlighted = highlighter.codeToHtml(code, {
     lang: resolvedLang,
     themes: { light: "github-light", dark: "github-dark" },
     defaultColor: false, // 라이트/다크 값을 둘 다 CSS 변수로 내보내게 함
   });
   ```

   `defaultColor: false`가 핵심이다 — 이 옵션을 켜면 Shiki가 색상을
   고정하지 않고 `--shiki-light`/`--shiki-dark`라는 CSS 변수 두 개를
   각 토큰에 심어주기 때문에, 별도의 JS 없이 CSS만으로 다크모드 토글에
   맞춰 코드 블록 색이 바뀐다.

   ```css
   /* frontend/src/app/globals.css */
   .shiki, .shiki span { color: var(--shiki-light); background-color: var(--shiki-light-bg); }
   .dark .shiki, .dark .shiki span { color: var(--shiki-dark); background-color: var(--shiki-dark-bg); }
   ```

이 셋을 하나의 함수로 합쳐서, 상세 페이지는 결과 HTML과 TOC 배열만
받아서 그리면 된다.

```ts
export async function renderPostContent(rawHtml: string) {
  const sanitized = sanitize(rawHtml);
  const { html: withIds, toc } = injectHeadingIds(sanitized);
  const highlighted = await highlightCodeBlocks(withIds);
  return { html: highlighted, toc };
}
```

### 왜 정규식이고, DOMParser/jsdom을 쓰지 않았나

상세 페이지가 Server Component(Node.js 환경)이기 때문에 브라우저 전용
`DOMParser`는 쓸 수 없다. `jsdom` 같은 라이브러리를 추가로 넣는 대신,
TipTap 에디터가 만들어내는 HTML 구조가 비교적 예측 가능하다는 점(항상
`<h1>~<h6>`, `<pre><code class="language-x">` 형태)을 이용해 정규식으로
처리했다. 의존성을 하나 더 늘리지 않고, Node/브라우저 어디서든 동일하게
동작한다는 것도 장점이다.

---

## 6. 스모크 테스트

`pnpm dev`로 백엔드/프론트엔드를 함께 띄우고, API로 테스트 게시글(헤딩
3개 + 코드 블록 1개 포함)을 발행해 직접 확인했다.

```bash
curl http://localhost:3000/posts/post
# → 헤딩에 id="소개-0" 등 한글 보존 id 부여 확인
# → <nav aria-label="목차"> 안에 TOC 링크 3개 생성 확인
# → 코드 블록이 <pre class="shiki" ...>로 치환되어 있음을 확인
curl -o /dev/null -w '%{http_code}' http://localhost:3000/posts/존재하지않는slug
# → 404 (notFound() 정상 동작)
```

로그인하지 않은 상태로 확인했기 때문에 수정/삭제 버튼은 (의도대로)
보이지 않았다. 테스트가 끝난 뒤에는 만들었던 테스트 게시글을 API로
삭제해 DB를 원상 복구했다.

> 이 과정에서 이전 세션(T057 스모크 테스트)에서 종료됐어야 할 dev 서버
> 프로세스가 포트 3000/4100에 여전히 떠 있는 걸 발견했다 —
> 백그라운드 태스크를 "중지"해도 실제 `next-server`/`node` 자식 프로세스가
> 남는 경우가 있어서, 이후로는 스모크 테스트가 끝나면 `netstat -ano`로
> 실제 리스닝 PID까지 확인해서 정리하는 습관을 들였다.

---

## 7. 남은 검증 항목

- [ ] 실제 TipTap 에디터(Phase 3-5, T062)로 작성한 게시글에서 코드
      블록/헤딩 마크업이 이번 파이프라인이 가정한 구조(`language-x` 클래스,
      `h1~h6`)와 정확히 일치하는지 재확인 — 에디터가 아직 없어서 수동으로
      만든 HTML로만 검증했다.
- [ ] Shiki가 지원하는 언어 목록(`renderPostContent.ts`의 `langs` 배열)에
      실제로 자주 쓰는 언어가 빠지지 않았는지 점검 (현재 JS/TS/JSX/TSX/
      JSON/Bash/CSS/HTML/SQL/Python/YAML/Markdown/Plaintext만 등록).

## 8. 배운 점

- ISR처럼 "서버 렌더링"이 전제인 Next.js 기능은, 그 페이지 자체를
  Server Component로 만들어야 한다 — 클라이언트 데이터 fetching(React
  Query 등)과는 애초에 레이어가 다르다. 한 프로젝트 안에서도 페이지
  성격에 따라 데이터 fetching 전략을 다르게 섞어 쓰는 것이 자연스럽다.
- 회원/카테고리 "상세 조회" API가 없을 때, 이미 있는 목록 API의 응답에
  포함된 요약 정보(닉네임, 카테고리명 등)로 우회하는 것은 실용적인
  선택이다 — 다만 그 데이터가 없는 edge case(글이 하나도 없는 회원)를
  fallback 문구로 명시적으로 처리해야 한다.
- 서버 사이드에서 HTML을 가공할 때는 무조건 DOM 파서를 쓰기보다, 입력의
  구조가 예측 가능하다면(자체 에디터가 만든 HTML처럼) 정규식으로도
  충분히 안전하게 처리할 수 있다 — 의존성과 실행 환경 제약을 줄일 수
  있다.
