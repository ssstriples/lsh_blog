# Phase 0-2: 프론트엔드 스캐폴딩 (T005~T009-S)

> 관련 태스크: `T005`, `T006`, `T007`, `T008`, `T009`, `T009-S`
> 작업일: 2026-08-07
> 결과물 위치: `frontend/`

## 1. 목표

Next.js 기반 프론트엔드 프로젝트의 뼈대를 만들고, 코드 스타일 통일 도구와
UI 컴포넌트 라이브러리(shadcn/ui), 다크모드까지 초기 세팅을 완료한다.

---

## 2. T005 — Next.js 프로젝트 생성

### 실행 명령어

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

### 옵션 설명 (초보자용)

| 옵션 | 의미 |
|------|------|
| `--typescript` | JS 대신 TypeScript 사용 (타입 안정성 ↑) |
| `--tailwind` | Tailwind CSS를 기본 스타일링 도구로 설치 |
| `--app` | Next.js의 최신 라우팅 방식인 **App Router** 사용 (`pages/` 대신 `app/`) |
| `--src-dir` | 소스코드를 `src/` 폴더 안에 모음 (루트가 지저분해지는 것 방지) |
| `--import-alias "@/*"` | `../../../components` 대신 `@/components`처럼 절대경로 import 가능 |
| `--use-pnpm` | 패키지 매니저로 pnpm 사용 |

### 설치된 핵심 패키지 버전

| 패키지 | 버전 |
|--------|------|
| next | 16.3.0 |
| react / react-dom | 19.2.8 |
| tailwindcss | 4.3.3 |
| typescript | 5.9.3 |

> 💡 **초보자 Tip**: Next.js 16부터는 Turbopack이 기본 번들러로 사용되어 빌드/개발 서버 속도가 훨씬 빠릅니다.

---

## 3. T006 — `src/` 디렉토리 구조 설계

프로젝트가 커질수록 "이 코드는 어디에 둬야 하지?"라는 고민이 생깁니다.
아래처럼 **역할별로 폴더를 미리 나눠두면** 나중에 코드를 찾기 쉽습니다.

```
frontend/src/
├── app/                 # Next.js App Router 페이지/레이아웃
├── components/
│   ├── layout/          # Header, Footer, ThemeToggle 등 레이아웃 공통 요소
│   ├── post/            # 게시글 관련 컴포넌트 (PostCard, PostContent 등)
│   ├── comment/         # 댓글 관련 컴포넌트
│   ├── admin/           # 관리자 전용 컴포넌트 (에디터, 대시보드 등)
│   ├── common/          # 어디서나 쓰이는 범용 컴포넌트 (Pagination, SearchBar)
│   └── ui/              # shadcn/ui가 생성하는 기본 UI 컴포넌트 (Button, Card 등)
├── lib/                 # 유틸 함수, API 클라이언트, 공용 로직
├── hooks/               # 커스텀 React 훅 (usePosts, useDebounce 등)
├── types/               # TypeScript 타입/인터페이스 정의
└── store/               # Zustand 전역 상태 저장소
```

> 각 폴더에는 Git이 빈 폴더를 추적하지 못하는 특성 때문에 `.gitkeep` 빈 파일을 하나씩 넣어두었습니다.

---

## 4. T007 — ESLint + Prettier 설정

### 왜 ESLint와 Prettier를 같이 쓰는가?
- **ESLint**: 코드의 "버그가 될 수 있는 패턴"을 잡아줌 (예: 사용하지 않는 변수)
- **Prettier**: 코드의 "생김새(포맷)"를 자동으로 통일 (예: 들여쓰기, 줄바꿈, 따옴표)
- 두 도구가 충돌하지 않도록 `eslint-config-prettier`로 ESLint의 포맷 관련 규칙을 끔

### 설치 명령어

```bash
pnpm add -D prettier eslint-config-prettier prettier-plugin-tailwindcss
```

### `eslint.config.mjs` 수정

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier, // ← Prettier와 충돌하는 규칙 비활성화
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
```

### `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

> `prettier-plugin-tailwindcss`는 Tailwind 클래스 순서를 자동으로 정렬해줍니다
> (예: `flex items-center p-4` → 항상 같은 순서로 정리).

### `.prettierignore`

```
.next
node_modules
pnpm-lock.yaml
build
dist
```

---

## 5. T008 — `shadcn/ui` 초기화

### shadcn/ui란?
버튼, 카드, 다이얼로그 같은 UI 컴포넌트를 **라이브러리로 설치하는 게 아니라,
소스 코드를 직접 내 프로젝트에 복사**해서 자유롭게 커스터마이징할 수 있게 해주는 도구입니다.

### 실행 명령어

```bash
pnpm dlx shadcn@latest init -y -d
```

### 생성된 파일

- `components.json` — shadcn/ui 설정 (경로 별칭, 스타일 등)
- `src/components/ui/button.tsx` — 첫 번째 컴포넌트
- `src/lib/utils.ts` — `cn()` 헬퍼 함수 (Tailwind 클래스 병합용)
- `src/app/globals.css` 업데이트 — 디자인 토큰(색상 변수) 추가

> ⚠️ **버전 참고**: 이 프로젝트의 shadcn/ui는 내부적으로 Radix UI 대신
> **Base UI**(`@base-ui/react`)를 사용하는 최신 버전입니다.
> 따라서 `asChild` prop 대신 `render` prop을 사용해야 합니다 (아래 트러블슈팅 참고).

---

## 6. T009 — 공통 컴포넌트 설치

```bash
pnpm dlx shadcn@latest add input card dialog badge sonner -y
```

| 요청했던 컴포넌트 | 실제 설치 | 비고 |
|---|---|---|
| Button | ✅ (T008에서 이미 설치) | |
| Input | ✅ | |
| Card | ✅ | |
| Dialog | ✅ | |
| Badge | ✅ | |
| Toast | `sonner`로 대체 설치 | shadcn/ui 최신 버전은 Toast 대신 `sonner` 토스트 라이브러리를 공식 권장 |

---

## 7. T009-S — 다크모드 (`next-themes`) 적용

### 왜 `next-themes`를 쓰는가?
직접 다크모드를 구현하려면 "localStorage에 저장 → 새로고침 시 깜빡임 방지(FOUC) → 시스템 설정 감지"
등을 모두 처리해야 하는데, `next-themes`가 이를 안정적으로 대신 처리해줍니다.

### 설치

```bash
pnpm add next-themes lucide-react
pnpm dlx shadcn@latest add dropdown-menu -y
```

### 구현한 파일

**`src/components/layout/theme-provider.tsx`** — 앱 전체를 감싸는 Provider

```tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

**`src/components/layout/theme-toggle.tsx`** — 라이트/다크/시스템 전환 버튼

```tsx
"use client";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon">
            <Sun className="dark:scale-0 ..." />
            <Moon className="dark:scale-100 ..." />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>라이트</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>다크</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>시스템</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**`src/app/layout.tsx`** 적용

```tsx
<html lang="ko" suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster />
    </ThemeProvider>
  </body>
</html>
```

> 💡 **`suppressHydrationWarning`이 필요한 이유**: 서버에서는 사용자의 다크모드 설정을 알 수 없기 때문에,
> 클라이언트에서 테마가 적용되는 순간 서버 렌더링 결과와 차이가 생깁니다. React가 이를 오류로 착각하지 않도록
> 경고를 의도적으로 끄는 것입니다 (실제 버그가 아님).

---

## 8. 트러블슈팅

### 문제: `pnpm run build` 시 TypeScript 오류

```
error TS2322: Type '{ children: Element; asChild: true; }' is not assignable...
Property 'asChild' does not exist on type 'IntrinsicAttributes & Props<unknown>'.
```

**원인**: 이 프로젝트에 설치된 shadcn/ui `dropdown-menu.tsx`는 Radix UI가 아니라
**Base UI**(`@base-ui/react/menu`) 기반으로 생성되었습니다. Base UI의 `Trigger` 컴포넌트는
Radix처럼 `asChild`로 자식 엘리먼트를 대체하는 대신, `render` prop에 렌더링할 엘리먼트를 직접 전달합니다.

**해결**:

```diff
- <DropdownMenuTrigger asChild>
-   <Button variant="outline" size="icon">...</Button>
- </DropdownMenuTrigger>
+ <DropdownMenuTrigger
+   render={<Button variant="outline" size="icon">...</Button>}
+ />
```

수정 후 `pnpm run build` 재실행 → 정상 컴파일 및 정적 페이지 생성 확인.

---

## 9. 최종 검증

```bash
pnpm run lint    # 통과
pnpm run build   # 통과 (Route: / , /_not-found 모두 정적 생성)
```

## 10. 완료 체크리스트

- [x] Next.js 16 프로젝트 생성 (`frontend/`)
- [x] `src/` 하위 폴더 구조 생성
- [x] ESLint + Prettier 통합 설정
- [x] shadcn/ui 초기화
- [x] 공통 UI 컴포넌트 설치 (Button/Input/Card/Dialog/Badge/Sonner)
- [x] 다크모드 ThemeToggle 구현 및 레이아웃 적용
- [x] 빌드/린트 통과 확인

## 11. 다음 단계

→ Phase 0-3 백엔드 초기 세팅 (Express + TypeScript + 보안 미들웨어)
