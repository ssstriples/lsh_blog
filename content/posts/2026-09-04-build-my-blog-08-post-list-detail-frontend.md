---
title: "기술 블로그를 직접 만들어보자 #8 — 목록은 실시간으로, 상세는 ISR로"
slug: "build-my-blog-08-post-list-detail-frontend"
date: "2026-09-04"
category: "프로젝트 회고"
tags: ["프론트엔드", "Next.js", "TanStack Query", "ISR", "Shiki"]
status: "DRAFT"
summary: "게시글 목록/상세 화면을 만들면서, 왜 목록은 클라이언트에서 실시간으로 가져오고 상세는 서버에서 ISR로 그려야 했는지, 그리고 코드 블록에 다크모드 대응 문법 하이라이팅을 어떻게 붙였는지 정리합니다."
---

# 기술 블로그를 직접 만들어보자 #8 — 목록은 실시간으로, 상세는 ISR로

> [5편](./2026-08-10-build-my-blog-05-post-crud-ownership-authorization.md)에서
> 게시글 CRUD API를, [7편](./2026-08-14-build-my-blog-07-categories-tags-korean-slug-bug.md)에서
> 카테고리/태그 API를 백엔드에 다 만들어뒀습니다. 이번 편은 드디어 그
> 데이터를 화면에 그리는 프론트엔드 차례입니다. 홈/카테고리/태그/작성자
> 목록 페이지와, 게시글 상세 페이지(목차 + 코드 하이라이팅 포함)를
> 만들었습니다.

## 이 글에서 다루는 내용

1. (사고 기록) `frontend/` 폴더가 통째로 딴 곳으로 이동해있던 사건
2. 목록 페이지 4개를 하나의 컴포넌트로 통일하기 (TanStack Query)
3. 상세 페이지는 왜 클라이언트가 아니라 **서버에서 ISR**로 그렸는가
4. 게시글 본문 렌더링 3단계: sanitize → 목차 추출 → 코드 하이라이팅
5. (트러블슈팅) 작업 디렉토리를 헷갈려서 패키지를 엉뚱한 곳에 설치한 일

---

## 1. (사고 기록) 폴더가 사라져 있었다

작업을 시작하려고 `git status`를 봤는데, `frontend/` 아래 파일이 전부
"삭제됨"으로 나왔습니다. 순간 당황했지만 차분히 살펴보니, 파일이 진짜
없어진 게 아니라 폴더 자체가 `docs/frontend/`라는 엉뚱한 위치로 옮겨져
있었던 것이었습니다 (`package.json` 내용까지 그대로인 걸 보면 확실).

> 💡 이런 상황에서는 절대 "일단 다시 만들자"고 성급하게 새 파일을
> 쓰면 안 됩니다. git이 "삭제됨"이라고 보여주는 게 실제 삭제인지,
> 아니면 이동/이름변경인지 먼저 확인하는 습관이 작업 내용을 지키는
> 가장 중요한 방어선입니다.

원래 위치로 폴더를 되돌리고(`mv docs/frontend frontend`), `git status`가
깨끗해진 걸 확인한 뒤에야 실제 작업을 시작했습니다.

---

## 2. 목록 페이지 4개, 컴포넌트 하나로

이번에 만들어야 하는 목록 페이지는 4개입니다.

- `/` — 홈 (전체 최신글)
- `/category/[slug]` — 카테고리별
- `/tag/[slug]` — 태그별
- `/users/[id]` — 작성자별 (공개 프로필)

넷 다 "페이지네이션 되는 게시글 카드 그리드"라는 모양이 완전히
똑같습니다. 다른 건 필터 조건(카테고리냐 태그냐 작성자냐)과 위쪽에
붙는 제목뿐이라, `PostGrid`라는 컴포넌트 하나로 몰아넣고 필터 조건만
props로 받게 만들었습니다.

```tsx
interface PostGridProps extends Omit<ListPostsParams, "page" | "limit"> {
  page: number;
  basePath: string; // "/", "/category/tech" 처럼 페이지네이션 링크의 기준 경로
}

export function PostGrid({ page, basePath, ...filters }: PostGridProps) {
  const { data, isPending, isError } = usePosts({ ...filters, page, limit: 12 });
  // 로딩 중 / 에러 / 빈 목록 / 정상 그리드+페이지네이션
}
```

데이터를 가져오는 방식은 **TanStack Query**(`@tanstack/react-query`)를
새로 붙였습니다. `fetch`를 직접 쓰지 않고 이 라이브러리를 쓰는 이유는,
"같은 데이터를 다시 요청하지 않고 캐시해서 재사용", "로딩/에러 상태를
`isPending`/`isError`처럼 값으로 바로 받기" 같은 걸 직접 구현하지 않아도
되기 때문입니다.

```tsx
export function usePosts(params: ListPostsParams = {}) {
  return useQuery({
    queryKey: ["posts", params],
    queryFn: () => apiFetch<PostListData>(`/api/posts${toQueryString(params)}`),
  });
}
```

카테고리 이름, 태그 이름을 헤딩에 보여줘야 하는데, "카테고리 하나
상세조회" 같은 API는 없습니다. 대신 전체 카테고리 목록(`GET
/api/categories`)을 가져와서 slug로 찾는 방식을 썼습니다. 작성자
프로필(`/users/[id]`)은 한 술 더 떠서, "회원 정보 조회" API 자체가
없기 때문에 그 작성자의 글 목록 API 응답에 이미 들어있는 `author.name`을
재활용했습니다 — 새 API를 만들지 않고도 닉네임을 보여줄 수 있는
실용적인 방법이었습니다.

---

## 3. 상세 페이지는 왜 서버에서 그렸나 (ISR)

목록 페이지들은 전부 브라우저(클라이언트)에서 데이터를 가져왔는데,
게시글 상세 페이지(`/posts/[slug]`)만 다르게 만들었습니다. 이유는
"ISR을 적용하라"는 요구사항 때문입니다.

> **ISR (Incremental Static Regeneration)**이 뭔가요? 페이지를 미리
> HTML로 만들어두고(정적 페이지처럼 빠르게 응답), 일정 시간(여기서는
> 60초)이 지나면 다음 요청이 왔을 때 백그라운드에서 조용히 새로
> 만들어 갈아치우는 방식입니다. 매번 새로 만드는 것보다 빠르고, 완전히
> 고정된 정적 페이지보다는 최신 데이터를 반영합니다.

ISR은 애초에 **Next.js 서버가 페이지를 만들어줄 때만** 의미가 있는
기능입니다. 브라우저에서 TanStack Query로 데이터를 가져오는 방식으로는
아예 적용할 수가 없습니다. 그래서 상세 페이지는 `async function`으로
된 서버 컴포넌트로 만들고, 맨 위에 이 한 줄을 추가했습니다.

```tsx
export const revalidate = 60; // 60초마다 재검증

async function getPost(slug: string) {
  try {
    return await apiFetch<PostDetail>(`/api/posts/${slug}`, { next: { revalidate } });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
```

재밌는 점은, 목록 페이지를 만들 때 이미 써둔 `apiFetch` 헬퍼를 그대로
가져다 쓸 수 있었다는 겁니다. Next.js가 전역 `fetch` 함수의 옵션에
`next: { revalidate }`라는 필드를 추가해두기 때문에, 헬퍼 코드를 하나도
안 고치고 옵션만 얹으면 됐습니다.

수정/삭제 버튼("본인 글일 때만 보이기")은 반대로 클라이언트 컴포넌트로
남겼습니다. 이미 헤더 컴포넌트가 `useSession()`으로 로그인 상태를
판단하는 방식을 쓰고 있어서, 같은 방식을 따라가는 게 일관성 있다고
판단했습니다.

```tsx
const { data: session } = useSession();
const canManage = session?.user && (session.user.id === authorId || session.user.role === "ADMIN");
if (!canManage) return null;
```

이렇게 하나의 페이지 안에서도 "서버에서 그릴 부분"과 "클라이언트에서
판단할 부분"을 섞어 쓸 수 있는 게 Next.js App Router의 특징입니다.

---

## 4. 본문 렌더링 3단계: sanitize → 목차 → 코드 하이라이팅

게시글 본문은 TipTap 에디터가 만든 HTML 문자열로 저장돼 있습니다.
이 HTML을 화면에 그대로 보여주기 전에 3단계 가공을 거칩니다.

### 4-1. 한 번 더 sanitize

백엔드가 저장 시점에 이미 XSS 위험 요소를 제거([5편](./2026-08-10-build-my-blog-05-post-crud-ownership-authorization.md) 참고)하지만, 프론트엔드에서
같은 라이브러리(`isomorphic-dompurify`)로 한 번 더 걸러냅니다. 이미
안전한 데이터를 한 번 더 검사하는 게 낭비처럼 보일 수도 있지만, "혹시
나중에 다른 경로로 DB에 이상한 HTML이 들어오더라도 화면에서는 최종
방어선을 하나 더 둔다"는 개념입니다.

### 4-2. 목차(TOC) 자동 생성

본문 안의 `<h1>`~`<h6>` 태그를 찾아서 각각 고유한 `id`를 붙이고, 그
목록을 따로 뽑아둡니다. 이 `id`가 있어야 목차에서 `#소개-0` 같은 링크를
눌렀을 때 그 위치로 스크롤될 수 있습니다.

```ts
function slugifyHeading(text: string, index: number): string {
  const base = text.trim().toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-가-힣]/g, ""); // 한글은 지우지 않고 보존
  return base ? `${base}-${index}` : `heading-${index}`;
}
```

> [7편](./2026-08-14-build-my-blog-07-categories-tags-korean-slug-bug.md)에서
> 카테고리 slug를 만들 때 라이브러리(`slugify`)가 한글을 통째로 지워버려
> 애먹었던 경험이 있어서, 이번엔 처음부터 한글을 보존하는 방식으로
> 직접 만들었습니다. 같은 실수를 두 번 반복하지 않은 셈입니다.

### 4-3. Shiki로 코드 블록 하이라이팅

`<pre><code class="language-typescript">...</code></pre>` 같은 코드
블록을 찾아서, **Shiki**라는 라이브러리로 문법 하이라이팅된 HTML로
바꿔치기합니다.

```ts
const highlighted = highlighter.codeToHtml(code, {
  lang: resolvedLang,
  themes: { light: "github-light", dark: "github-dark" },
  defaultColor: false,
});
```

`defaultColor: false`라는 옵션이 이 블로그의 다크모드 토글과 맞물리는
핵심입니다. 이 옵션을 켜두면 Shiki가 색상 값을 고정하지 않고,
`--shiki-light`/`--shiki-dark`라는 CSS 변수 두 개를 코드에 심어줍니다.
그러면 CSS 쪽에서 다크모드 여부에 따라 어느 변수를 쓸지만 정해주면 됩니다.

```css
.shiki, .shiki span { color: var(--shiki-light); }
.dark .shiki, .dark .shiki span { color: var(--shiki-dark); }
```

이렇게 하면 자바스크립트로 "다크모드니까 테마를 다시 계산해서
다시 그리기" 같은 걸 할 필요 없이, CSS 클래스 하나(`.dark`)만 바뀌면
코드 블록 색이 즉시 따라 바뀝니다.

> **왜 DOM 파서(jsdom 등) 대신 정규식을 썼나요?** 상세 페이지는
> Node.js(서버)에서 실행되기 때문에 브라우저 전용 도구인 `DOMParser`를
> 쓸 수 없습니다. 새 의존성(`jsdom`)을 추가하는 대신, 우리 에디터가
> 만들어내는 HTML 구조가 항상 예측 가능한 패턴(`<h1>~<h6>`,
> `<pre><code class="language-x">`)이라는 점을 이용해 정규식으로
> 처리했습니다. 무조건 정답은 아니지만, 입력이 우리가 직접 통제하는
> 에디터에서 나온다면 충분히 합리적인 선택입니다.

---

## 5. (트러블슈팅) 패키지를 엉뚱한 폴더에 설치했다

`@tanstack/react-query`를 설치하려고 `pnpm add`를 실행했는데, 나중에
보니 `frontend/package.json`이 아니라 `backend/package.json`에 들어가
있었습니다. 원인은 단순했습니다 — 바로 전 명령에서 `cd backend`를
했었는데, 다음 명령을 낼 때 그 사실을 깜빡하고 그대로 `pnpm add`를
실행한 것입니다.

**해결**: `backend`에서 `pnpm remove`로 지우고, `frontend`로 제대로
이동한 뒤 다시 설치했습니다. 이후로는 디렉토리를 옮겨 다니는 작업을 할
때마다 `pwd`로 현재 위치를 먼저 확인하는 습관을 들였습니다. 작은
습관이지만, 여러 폴더(`frontend`/`backend`)를 오가며 작업하는 프로젝트
구조에서는 꽤 자주 발목을 잡는 실수라 기록해둡니다.

---

## 마무리

이번 편에서는 목록 페이지 4개를 하나의 컴포넌트로 통일하고, 상세
페이지는 ISR로 서버에서 그리는 방식을 택했습니다. 그리고 게시글
본문을 sanitize → 목차 추출 → 코드 하이라이팅 3단계로 가공하는
파이프라인을 만들었습니다.

다음 편에서는 지금까지 "보여주기만" 했던 게시글을 실제로 **작성하고
수정할 수 있는 TipTap 에디터 화면**을 만들어보겠습니다. 이 에디터가
만들어내는 실제 HTML이 이번 편에서 가정한 구조(헤딩, 코드 블록)와
정확히 맞아떨어지는지도 함께 확인해볼 예정입니다.
