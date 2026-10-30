---
title: "기술 블로그를 직접 만들어보자 #9 — TipTap 에디터와 '날아가지 않는' 글쓰기 화면"
slug: "build-my-blog-09-tiptap-editor-autosave"
date: "2026-10-31"
category: "프로젝트 회고"
tags: ["프론트엔드", "Next.js", "TipTap", "Zustand", "Zod"]
status: "DRAFT"
summary: "TipTap 리치 에디터로 글쓰기/수정 화면을 만들면서, 남의 글 수정 화면을 서버에서 막는 방법, 30초 자동저장을 안전하게 만드는 법, 그리고 '제목만 고쳤는데 글이 비공개가 되는' Zod 4 버그를 잡은 과정을 정리합니다."
---

# 기술 블로그를 직접 만들어보자 #9 — TipTap 에디터와 '날아가지 않는' 글쓰기 화면

> [8편](./2026-09-04-build-my-blog-08-post-list-detail-frontend.md)에서 게시글
> 목록과 상세 화면을 만들었습니다. 그런데 아직 글을 **쓸 수 있는 화면**이
> 없었죠. 이번 편에서는 드디어 글쓰기 에디터를 붙이고, 수정·임시저장·발행·삭제,
> 그리고 "내가 쓴 글" 목록과 관리자용 모더레이션 화면까지 만들었습니다.

## 이 글에서 다루는 내용

1. TipTap으로 리치 텍스트 에디터 만들기 (코드 블록, 표, 이미지)
2. 남의 글 수정 화면은 **서버에서** 막아야 하는 이유
3. 30초 자동저장 — localStorage에 저장할 때 조심할 점
4. 저장했는데 화면이 안 바뀐다? 캐시를 두 번 지워야 하는 이유
5. (트러블슈팅) 제목만 고쳤는데 글이 비공개가 되는 버그

---

## 1. TipTap으로 에디터 만들기

> 💡 **리치 텍스트 에디터**: 굵게, 제목, 목록, 이미지처럼 "서식 있는 글"을
> 워드프로세서처럼 쓸 수 있게 해주는 입력창입니다. 결과물은 HTML입니다.

여러 후보 중 **TipTap**을 고른 이유는 세 가지입니다.

- 필요한 기능만 "확장(extension)"으로 골라 끼우는 구조라 가볍다
- React용 공식 바인딩이 있다
- 출력이 깔끔한 HTML이라, 8편에서 만든 상세 페이지 렌더러에 그대로 넣을 수 있다

```bash
# frontend/
pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extensions \
  @tiptap/extension-image @tiptap/extension-table @tiptap/extension-text-align \
  @tiptap/extension-code-block-lowlight lowlight zustand
```

에디터 설정의 핵심은 이렇습니다.

```tsx
// components/write/RichTextEditor.tsx
const lowlight = createLowlight(common);

const editor = useEditor({
  immediatelyRender: false, // ⚠️ Next.js에서는 필수
  extensions: [
    StarterKit.configure({
      codeBlock: false, // 아래 CodeBlockLowlight로 교체
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
    Image,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder: "본문을 작성하세요..." }),
  ],
  content: initialContent,
  onUpdate: ({ editor }) => onChange(editor.getHTML()),
});
```

> 💡 **`immediatelyRender: false`가 왜 필요한가요?** Next.js는 페이지를 먼저
> 서버에서 HTML로 그린 뒤, 브라우저에서 다시 "살려냅니다(hydration)". 에디터는
> 브라우저에만 있는 기능(DOM 선택 영역 등)에 의존하기 때문에, 서버에서 미리
> 그리면 두 결과가 달라져 경고가 납니다. 그래서 "브라우저에 올라온 뒤에 그려라"고
> 알려주는 옵션입니다.

### 툴바는 "필요한 값만" 구독하기

이 프로젝트는 React Compiler(자동으로 렌더링을 최적화해주는 도구)를 켜 두었습니다.
그런데 TipTap의 `editor` 객체는 같은 객체 안에서 내용이 계속 바뀌는 구조라,
"굵게 버튼이 눌려 있나?" 같은 값을 그냥 읽으면 화면이 제때 갱신되지 않을 수
있습니다. TipTap이 주는 `useEditorState`로 **필요한 값만 뽑아서 구독**하면
이 문제를 피할 수 있고, 키를 누를 때마다 툴바 전체가 다시 그려지지도 않습니다.

```tsx
const state = useEditorState({
  editor,
  selector: ({ editor: e }) => ({
    bold: e.isActive("bold"),
    codeBlock: e.isActive("codeBlock"),
    table: e.isActive("table"),
    canUndo: e.can().undo(),
  }),
});
```

커서가 코드 블록 안에 있으면 **언어 선택 드롭다운**이, 표 안에 있으면
**행/열 추가·삭제** 버튼이 나타나도록 했습니다.

### 8편의 "가정"이 맞는지 확인하기

8편에서 상세 페이지 렌더러는 코드 블록이 `<pre><code class="language-xxx">`
모양이라고 **가정**하고 만들었습니다. 이번에 실제 TipTap 소스를 열어
확인해보니 정확히 그 모양으로 출력하고 있었습니다.

```js
// @tiptap/extension-code-block 내부
["pre", ..., ["code", { class: languageClassPrefix + node.attrs.language }, 0]]
// languageClassPrefix 기본값 = "language-"
```

에디터 안에서 보이는 색칠(lowlight)은 저장되는 HTML에 섞이지 않고, 발행된
글에서는 8편의 Shiki가 다시 예쁘게 칠해줍니다. 에디터에서 고를 수 있는 언어
목록도 Shiki가 지원하는 목록과 똑같이 맞췄습니다.

---

## 2. 남의 글 수정 화면은 서버에서 막는다

`/posts/<id>/edit`에 다른 사람이 들어오면 `/403` 페이지로 보내야 합니다.
가장 쉬운 방법은 "브라우저에서 글을 불러온 다음, 작성자가 내가 아니면
튕겨내기"지만, 이러면 **잠깐이라도 남의 임시저장 원고가 브라우저로
전송됩니다**. 네트워크 탭만 열어보면 다 보이죠.

그래서 수정 페이지는 **서버 컴포넌트**로 만들었습니다.

```tsx
// app/posts/[slug]/edit/page.tsx
const session = await auth();
try {
  post = await apiFetch(`/api/posts/${postId}/edit`, { accessToken: session.accessToken });
} catch (err) {
  if (err instanceof ApiError) {
    if (err.status === 403) redirect("/403"); // 남의 글
    if (err.status === 404) notFound();       // 없는 글
  }
  throw err;
}
```

여기서 중요한 점은 **"내 글인가?"를 프론트가 판단하지 않는다**는 겁니다.
판단은 5편에서 만든 백엔드의 `requireOwnership` 미들웨어가 하고, 프론트는
그 결과(403)를 보고 이동만 합니다. 이를 위해 백엔드에 수정 화면 전용 API를
하나 열었습니다.

```ts
// 수정 화면 진입용 — 임시저장(DRAFT) 글도 내려주므로 반드시 소유권 검증 뒤에!
router.get("/:id/edit", requireAuth, ownershipCheck, detailById);
```

> 💡 **폴더 이름이 왜 `[slug]/edit`인가요?** 이미 상세 페이지가 `/posts/[slug]`로
> 있어서, 같은 위치에 `[id]`라는 다른 이름을 쓰면 Next.js가 거부합니다. 그래서
> 폴더 이름은 `[slug]`를 같이 쓰고, 수정 페이지에서는 그 값을 id로 읽습니다.

---

## 3. 30초 자동저장 — 조심할 점 세 가지

글을 한참 쓰다가 탭을 실수로 닫으면 정말 괴롭습니다. 그래서 작성 중인
내용을 **30초마다 브라우저(localStorage)에 자동저장**하고, 다시 들어오면
"저장하지 않은 원고가 있습니다 [불러오기] [버리기]"를 보여주게 했습니다.

> 💡 **localStorage**: 브라우저 안에 키-값 형태로 데이터를 저장하는 공간입니다.
> 탭을 닫아도 남아 있지만, 그 브라우저에만 있고 서버로는 가지 않습니다.

여기서 헷갈리기 쉬운 게, 화면에 있는 **[임시저장] 버튼은 이것과 다릅니다.**

| | 자동저장 | [임시저장] 버튼 |
|---|---|---|
| 어디에? | 내 브라우저 | 서버 DB (비공개 상태) |
| 언제? | 30초마다 자동 | 버튼 누를 때 |
| 왜? | 탭이 닫혀도 원고 보존 | 다른 기기에서 이어쓰기 |

상태 관리는 Zustand의 `persist` 기능을 썼습니다. 만들면서 조심한 점이
세 가지 있습니다.

**① 서버에는 localStorage가 없다.** Next.js는 서버에서도 컴포넌트를 그리기
때문에, 자동으로 불러오게 두면 문제가 생깁니다. `skipHydration: true`로
자동 불러오기를 끄고, 브라우저에 올라온 뒤 직접 불러옵니다.

```ts
persist(..., {
  name: "lsh-blog-post-drafts",
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
});
```

**② 불러오기 전에 저장하면 다른 원고가 지워진다.** 불러오기가 끝나기 전의
저장소는 텅 빈 상태입니다. 이때 저장을 해버리면 "빈 상태 + 지금 글 하나"로
localStorage 전체를 덮어써서, 다른 글의 원고가 사라집니다. 그래서 불러오기가
끝났는지 확인한 뒤에만 저장하도록 막았습니다.

**③ 계정과 글마다 따로 저장한다.** 저장 키를 `사용자id:글id`로 만들어서,
한 컴퓨터를 여러 사람이 써도 남의 원고가 뜨지 않고, 새 글과 수정 중인 글도
서로 덮어쓰지 않습니다.

그리고 **바뀐 게 있을 때만** 저장합니다. 가만히 둔 탭이 "방금 저장됨"을
계속 갱신하면 진짜 저장 시점을 알 수 없으니까요.

---

## 4. 저장했는데 화면이 안 바뀐다? 캐시를 두 번 지우기

8편에서 상세 페이지는 **ISR**(60초마다 새로 만드는 정적 페이지)로 만들었습니다.
빠르긴 하지만, 글을 고치고 발행해도 **최대 60초 동안 옛날 내용이 보입니다.**

그래서 저장에 성공하면 두 가지 캐시를 모두 비웁니다.

1. **브라우저 쪽 캐시 (TanStack Query)**: 목록 화면들이 가진 데이터
2. **서버 쪽 캐시 (ISR)**: 상세 페이지 HTML → Server Action으로 `revalidatePath` 호출

```ts
// lib/actions/revalidatePost.ts
"use server";
export async function revalidatePostPages(slugs: string[]) {
  const session = await auth();
  if (!session?.user) return; // 아무나 캐시를 비우지 못하게
  for (const slug of new Set(slugs)) {
    if (/^[a-z0-9-]{1,200}$/.test(slug)) revalidatePath(`/posts/${slug}`);
  }
}
```

> 💡 **Server Action**: 브라우저에서 함수처럼 부르면 실제로는 서버에서 실행되는
> 기능입니다. 편리하지만 결국 **누구나 호출할 수 있는 공개 주소**라서, 안에서
> 로그인 여부와 입력값을 꼭 검사해야 합니다.

슬러그(주소)를 바꿔서 저장한 경우엔 **예전 주소의 캐시도** 함께 지워야 합니다.
안 그러면 옛 주소로 들어온 사람이 지워진 내용을 계속 보게 되니까요.

---

## 5. 트러블슈팅: 제목만 고쳤는데 글이 비공개가 된다

수정 화면을 만들기 전에, 수정 API의 입력 검증 코드를 다시 읽다가
이상한 점을 발견했습니다.

```ts
const createPostSchema = z.object({
  // ...
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
});
const updatePostSchema = createPostSchema.partial(); // "모든 필드를 선택 사항으로"
```

의도는 "수정할 때는 보낸 필드만 바꾼다"였습니다. 그런데 정말 그럴까요?
직접 돌려봤습니다.

```bash
node -e "
const {z}=require('zod');
const s=z.object({status:z.enum(['DRAFT','PUBLISHED']).optional().default('DRAFT'), t:z.string().optional()}).partial();
console.log(JSON.stringify(s.parse({t:'a'})));
"
# {"status":"DRAFT","t":"a"}   ← status를 안 보냈는데 DRAFT가 채워짐!
```

**원인**: 이 프로젝트는 Zod **4**를 씁니다. `.partial()`은 필드를 "없어도 됨"으로
만들 뿐, 안에 있던 `.default("DRAFT")`는 그대로 살아있어서 값이 없으면 기본값을
넣어버립니다. 그러면 서버는 "status를 DRAFT로 바꾸라는 요청"으로 받아들입니다.
결과적으로 **발행된 글의 오타 하나만 고쳐도 글이 비공개로 바뀌는** 버그였습니다.
에러도 안 나고 조용히 데이터만 바뀌는, 가장 찾기 어려운 종류의 버그죠.

**해결**: 수정용 스키마에서는 status를 기본값 없이 다시 정의했습니다.

```ts
export const updatePostSchema = createPostSchema
  .extend({ status: z.enum(["DRAFT", "PUBLISHED"]) })
  .partial();
```

수정 후 "발행 글 생성 → 제목만 수정 → 여전히 발행 상태인지" 테스트로 확인했습니다.

> 💡 **교훈**: 라이브러리의 메이저 버전(3 → 4)이 바뀌면, 예전엔 당연했던 동작도
> 직접 한 번 돌려보고 확인하는 게 안전합니다.

---

## 그 밖에 만든 것들

- **`/my/posts` 마이페이지**: 내가 쓴 글 목록. 제목 검색, 전체/발행/임시저장 필터,
  상태 배지, 바로 발행/비공개 전환·수정·삭제 버튼. 필터는 URL(`?q=&status=`)에
  담아서 새로고침해도 유지됩니다.
- **`/admin/posts` 모더레이션**: 관리자는 글을 직접 고치지 않고, 부적절한 글을
  **비공개 전환**하거나 **강제 삭제**만 합니다. 작성자 이름·이메일로도 검색됩니다.
- **태그 입력**: Enter나 쉼표로 추가. 한글 입력 중(조합 중)에 Enter를 누르면
  마지막 글자가 두 번 들어가는 문제가 있어, 조합 중인 Enter는 무시했습니다.
- **이미지 업로드**: 7편의 Cloudinary API에 연결. 파일을 보낼 때(`FormData`)는
  `Content-Type` 헤더를 직접 지정하면 안 됩니다 — 브라우저가 경계값(boundary)을
  붙여야 서버가 파일을 읽을 수 있거든요.

## 테스트

API 17건(남의 글 수정 화면 403, 비로그인 401, 임시저장 글 공개 차단, 필터 등)과
화면 접근 9건(비로그인 → 로그인 페이지, 남의 글 수정 → 403 페이지 등)을
스크립트로 확인했고, 프로덕션 빌드도 통과했습니다. 다만 에디터에 직접 타이핑하고
이미지를 올리고 자동저장 배너를 확인하는 **브라우저 상호작용 테스트는 다음에
직접 손으로 확인할 예정**입니다.

---

## 마무리

이번 편으로 블로그의 "쓰기"가 완성됐습니다. 정리하면,

- 권한 판단은 **백엔드**가, 프론트는 결과만 해석한다
- 자동저장은 **불러오기가 끝난 뒤에만** 저장한다
- 캐시가 두 겹이면 **둘 다** 지운다
- 라이브러리 버전이 바뀌면 **직접 돌려서** 확인한다

다음 편에서는 게시글 아래에 **댓글 시스템**을 붙입니다. 대댓글(트리 구조),
로그인 없이 쓰는 게스트 댓글, 그리고 스팸을 막는 Rate Limit까지 다뤄보겠습니다.
