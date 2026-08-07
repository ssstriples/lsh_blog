---
title: "기술 블로그를 직접 만들어보자 #1 — 개발 환경부터 Next.js 다크모드까지"
slug: "build-my-blog-01-dev-environment-nextjs-setup"
date: "2026-08-07"
category: "프로젝트 회고"
tags: ["Next.js", "TypeScript", "shadcn/ui", "개발환경", "다크모드"]
status: "DRAFT"
summary: "개인 기술 블로그(lsh_blog)를 처음부터 만드는 과정을 기록합니다. 1편에서는 개발 환경 구성부터 Next.js 16 프로젝트 생성, ESLint/Prettier, shadcn/ui, 다크모드 구현까지 다룹니다."
---

# 기술 블로그를 직접 만들어보자 #1 — 개발 환경부터 Next.js 다크모드까지

> 이 글은 제가 개인 기술 블로그(`lsh_blog`)를 처음부터 만들어가는 과정을 기록한 시리즈의 첫 번째 글입니다.
> 코드를 처음 접하는 분도 따라올 수 있도록, **왜 이 선택을 했는지**까지 최대한 풀어서 썼습니다.

## 이 글에서 다루는 내용

1. 개발을 시작하기 전 준비물 (Node.js, pnpm, VS Code 확장)
2. GitHub 저장소 연결과 `.gitignore`가 왜 중요한지
3. Next.js 16으로 프로젝트 뼈대 만들기
4. 코드 스타일을 자동으로 맞춰주는 ESLint + Prettier
5. `shadcn/ui`로 예쁜 UI 컴포넌트 가져오기
6. 다크모드 토글 버튼 만들기

---

## 1. 왜 개발 환경부터 신경 써야 할까?

집을 지을 때 기초 공사를 대충 하면 나중에 벽에 금이 가듯, 코드도 마찬가지입니다.
"버전이 안 맞아서 안 돌아가요", "제 컴퓨터에서는 되는데요?" 같은 문제를 미리 막기 위해
**팀(혹은 미래의 나)이 똑같은 환경에서 작업할 수 있도록** 아래 3가지를 먼저 확인했습니다.

```bash
node --version   # v22.20.0
npm --version    # 10.9.3
pnpm --version   # 10.33.0
```

### 잠깐, pnpm이 뭔가요?

`npm`, `yarn`, `pnpm`은 모두 "패키지 매니저"입니다. 즉, 다른 사람이 만든 코드(라이브러리)를
쉽게 설치하고 관리해주는 도구예요. 이 중 `pnpm`은:

- 같은 라이브러리를 여러 프로젝트에서 써도 **디스크에 한 번만 저장**해서 용량을 아낍니다.
- 설치 속도가 `npm`보다 빠릅니다.

설치가 안 되어 있다면 아래 명령어로 전역 설치할 수 있어요.

```bash
npm install -g pnpm
```

---

## 2. VS Code 확장 프로그램 준비

에디터에 아래 4가지 확장을 설치하면 개발이 훨씬 편해집니다.

| 확장 | 하는 일 |
|------|---------|
| **ESLint** | 코드에 잠재적인 버그나 나쁜 습관이 있으면 바로 알려줌 |
| **Prettier** | 저장할 때 코드 모양(들여쓰기, 줄바꿈 등)을 자동으로 예쁘게 정리 |
| **Prisma** | 데이터베이스 스키마 파일(`.prisma`)에 색깔과 자동완성을 붙여줌 |
| **Tailwind CSS IntelliSense** | Tailwind CSS 클래스를 입력할 때 자동완성과 미리보기 제공 |

이 확장들을 팀원 모두에게 "추천"하고 싶다면, 프로젝트 루트에 아래 파일을 만들면 됩니다.
누군가 이 폴더를 VS Code로 열면 "이 확장들을 설치할까요?"라는 알림이 자동으로 뜹니다.

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss"
  ]
}
```

---

## 3. Git과 `.gitignore` — 절대 잊으면 안 되는 보안 습관

### `.env` 파일은 왜 Git에 올리면 안 될까요?

`.env` 파일에는 보통 데이터베이스 비밀번호, API 키 같은 **민감한 정보**가 들어갑니다.
이걸 실수로 GitHub 같은 공개 저장소에 올리면, 전 세계 누구나 그 값을 볼 수 있게 되어
심각한 보안 사고로 이어질 수 있어요. (실제로 이런 실수로 계정이 해킹당하는 사례가 매우 많습니다!)

그래서 `.gitignore`라는 파일에 "Git아, 이 파일/폴더들은 절대 추적하지 마"라고 미리 적어둡니다.

```gitignore
# 의존성 (재설치 가능하므로 Git에 올릴 필요 없음)
node_modules/

# 환경변수 (비밀 정보! 절대 커밋 금지)
.env
.env.local
.env.*.local
!.env.example   # 단, 예시 파일은 예외로 허용

# Next.js가 빌드할 때 생기는 임시 폴더
.next/

# 로그 파일
*.log
```

> 💡 `.env.example`은 실제 비밀번호 없이 "어떤 환경변수 이름이 필요한지"만 적어두는 파일이에요.
> 예: `DATABASE_URL=` (값은 비워둠). 팀원이 이 파일을 복사해서 자신의 `.env`를 채우도록 안내하는 용도입니다.

---

## 4. Next.js 프로젝트 만들기

이제 진짜 코드를 작성할 프로젝트를 만들 차례입니다. 아래 한 줄 명령어로 뼈대가 자동으로 생성됩니다.

```bash
pnpm create next-app@latest frontend \
  --typescript \
  --tailwind \
  --app \
  --eslint \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm \
  --yes
```

### 옵션이 낯설다면? 하나씩 풀이해드릴게요

- `--typescript`: 일반 JavaScript 대신 **타입**이 있는 TypeScript를 사용합니다.
  타입을 쓰면 "이 변수는 숫자인데 문자열을 넣으려고 했네요!" 같은 실수를 코드 작성 중에 바로 잡아줍니다.
- `--tailwind`: CSS를 직접 작성하지 않고, `class="flex items-center p-4"`처럼
  **미리 정의된 클래스 이름**을 조합해서 스타일을 입히는 방식(Tailwind CSS)을 사용합니다.
- `--app`: Next.js의 최신 라우팅 방식인 **App Router**를 사용합니다.
  (`src/app/` 폴더 구조 = 폴더 이름이 곧 URL 경로가 되는 방식)
- `--src-dir`: 소스 코드를 `src/` 폴더 안에 모아서, 프로젝트 루트가 지저분해지지 않게 합니다.
- `--import-alias "@/*"`: `../../../components/Button` 같은 복잡한 경로 대신
  `@/components/Button`처럼 짧게 쓸 수 있게 해줍니다.

실행하면 아래 버전들이 설치됩니다.

| 패키지 | 버전 |
|--------|------|
| Next.js | 16.3.0 |
| React | 19.2.8 |
| Tailwind CSS | 4.3.3 |
| TypeScript | 5.9.3 |

---

## 5. 폴더 구조 미리 정리하기

프로젝트가 커지면 "이 컴포넌트를 어디에 둬야 하지?"라는 고민이 계속 생깁니다.
그래서 처음부터 역할별로 폴더를 나눠뒀어요.

```
frontend/src/
├── app/          # 페이지들 (URL 경로가 됨)
├── components/
│   ├── layout/   # 헤더, 푸터, 다크모드 버튼처럼 레이아웃에 쓰이는 것들
│   ├── post/     # 게시글 카드, 게시글 본문 렌더러 등
│   ├── comment/  # 댓글 목록, 댓글 입력창
│   ├── admin/    # 관리자 전용 화면 (글쓰기 에디터 등)
│   ├── common/   # 페이지네이션처럼 어디서나 쓰이는 것들
│   └── ui/       # 버튼, 카드 등 기본 UI 부품
├── lib/          # 자주 쓰는 유틸 함수
├── hooks/        # 커스텀 React 훅
├── types/        # 타입 정의
└── store/        # 전역 상태 관리
```

---

## 6. ESLint + Prettier로 코드 스타일 자동 정리

여러 사람이 코드를 짜면 스타일이 제각각이라 읽기 힘들어집니다.
그래서 **저장할 때마다 자동으로 코드 모양을 통일**해주는 Prettier와,
**잠재적인 버그를 잡아주는** ESLint를 함께 씁니다.

```bash
pnpm add -D prettier eslint-config-prettier prettier-plugin-tailwindcss
```

`prettier-plugin-tailwindcss`는 Tailwind 클래스 순서까지 자동으로 정렬해주는 편리한 플러그인입니다.

```json
// .prettierrc.json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

## 7. `shadcn/ui`로 버튼, 카드 컴포넌트 가져오기

보통 UI 라이브러리는 `npm install`로 설치하면 코드가 `node_modules` 안에 숨겨져서
커스터마이징하기 번거롭습니다. `shadcn/ui`는 다릅니다 — **컴포넌트의 실제 소스 코드를
내 프로젝트 폴더 안에 직접 복사**해줘서, 마음대로 수정할 수 있습니다.

```bash
pnpm dlx shadcn@latest init -y -d
pnpm dlx shadcn@latest add input card dialog badge sonner -y
```

이렇게 하면 `src/components/ui/` 폴더에 `button.tsx`, `input.tsx`, `card.tsx` 같은
파일들이 생성됩니다. 필요하면 이 파일을 열어서 직접 스타일을 바꾸면 됩니다.

> 참고: 원래 "Toast(알림 팝업)" 컴포넌트를 요청했는데, 최신 shadcn/ui에서는
> `sonner`라는 별도 라이브러리 사용을 권장해서 그걸 대신 설치했습니다.

---

## 8. 다크모드 토글 버튼 만들기

요즘 웹사이트에는 라이트모드/다크모드를 바꿀 수 있는 버튼이 거의 필수죠.
직접 만들려면 생각보다 신경 쓸 게 많습니다 (새로고침 시 깜빡임 방지, 시스템 설정 감지 등).
그래서 이 부분을 대신 처리해주는 `next-themes` 라이브러리를 사용했습니다.

```bash
pnpm add next-themes lucide-react
pnpm dlx shadcn@latest add dropdown-menu -y
```

핵심 코드는 이렇습니다 (초보자를 위해 조금 단순화했어요):

```tsx
"use client";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <div>
      <button onClick={() => setTheme("light")}>라이트</button>
      <button onClick={() => setTheme("dark")}>다크</button>
      <button onClick={() => setTheme("system")}>시스템</button>
    </div>
  );
}
```

실제 프로젝트에서는 여기에 드롭다운 메뉴와 아이콘(해/달)을 붙여서 조금 더 예쁘게 만들었습니다.

### 🔥 삽질 포인트: `asChild` 오류

컴포넌트를 조합하다가 이런 타입 에러를 만났습니다.

```
Property 'asChild' does not exist on type 'IntrinsicAttributes & Props<unknown>'.
```

**원인을 알아보니**, 제가 쓰던 shadcn/ui 버전은 내부적으로 `Base UI`라는 최신 라이브러리를
사용하고 있었고, 이 라이브러리는 다른 라이브러리들이 흔히 쓰는 `asChild` 방식 대신
`render`라는 prop으로 "이 버튼처럼 보이게 렌더링해줘"라고 지정하는 방식을 씁니다.

```diff
- <DropdownMenuTrigger asChild>
-   <Button>메뉴 열기</Button>
- </DropdownMenuTrigger>
+ <DropdownMenuTrigger render={<Button>메뉴 열기</Button>} />
```

이렇게 고치니 정상적으로 빌드가 통과했습니다.

> 💡 **배운 점**: 라이브러리 버전이 올라가면 API 사용법(문법)이 바뀔 수 있습니다.
> 에러 메시지를 잘 읽고, 해당 라이브러리의 타입 정의 파일(`.d.ts`)을 열어보면
> 어떤 prop을 지원하는지 직접 확인할 수 있어요.

---

## 9. 마무리 — 잘 작동하는지 확인하기

모든 설정이 끝나면 아래 두 명령어로 문제가 없는지 확인합니다.

```bash
pnpm run lint    # 코드 스타일/잠재적 버그 검사
pnpm run build   # 실제 배포용 빌드가 성공하는지 확인
```

두 명령어 모두 에러 없이 통과하면 성공입니다! 🎉

---

## 다음 편 예고

다음 글에서는 **Express + TypeScript**로 백엔드 서버를 만들고,
`helmet`, `express-rate-limit` 같은 보안 미들웨어를 붙이는 과정을 다룰 예정입니다.

> 이 시리즈의 모든 코드는 [GitHub 저장소](https://github.com/ssstriples/lsh_blog)에서 확인할 수 있습니다.
