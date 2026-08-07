# Phase 0-1: 개발 환경 구성 (T001~T004)

> 관련 태스크: `T001`, `T002`, `T003`, `T004`
> 작업일: 2026-08-07

## 1. 목표

프로젝트를 시작하기 전에 팀(또는 나) 모두가 동일한 환경에서 작업할 수 있도록
**개발 도구 버전, 에디터 확장, 원격 저장소, 무시 파일**을 확정한다.

---

## 2. T001 — Node.js / pnpm 버전 확인

### 왜 필요한가?
- Node.js 버전이 다르면 같은 코드도 다르게 동작하거나 설치가 실패할 수 있음
- 패키지 매니저로는 `npm` 대신 **pnpm**을 사용 (디스크 공간 절약 + 설치 속도, onggi-shop 프로젝트와 동일한 방식 채택)

### 실행 명령어

```bash
node --version
npm --version
pnpm --version
```

### 확인된 버전

| 도구 | 버전 |
|------|------|
| Node.js | v22.20.0 |
| npm | 10.9.3 |
| pnpm | 10.33.0 |

> 💡 **초보자 Tip**: `pnpm`이 없다면 `npm install -g pnpm`으로 전역 설치합니다.
> Node.js는 [nodejs.org](https://nodejs.org)에서 LTS 버전을 설치하는 것을 권장합니다.

---

## 3. T002 — VS Code 확장 확인

### 필요한 확장 4가지와 이유

| 확장 ID | 이름 | 왜 필요한가 |
|---------|------|------------|
| `dbaeumer.vscode-eslint` | ESLint | 코드 작성 중 실시간으로 문법/스타일 오류를 잡아줌 |
| `esbenp.prettier-vscode` | Prettier | 저장할 때 코드 스타일을 자동으로 통일 (들여쓰기, 따옴표 등) |
| `prisma.prisma` | Prisma | `.prisma` 스키마 파일에 문법 강조, 자동완성 제공 |
| `bradlc.vscode-tailwindcss` | Tailwind CSS IntelliSense | Tailwind 클래스 이름 자동완성 및 미리보기 |

### 팀 전체에 확장을 강제 추천하는 방법

VS Code는 `.vscode/extensions.json` 파일에 "권장 확장 목록"을 적어두면,
누군가 이 프로젝트 폴더를 열었을 때 자동으로 "이 확장들을 설치하시겠습니까?" 알림을 띄워줍니다.

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

> 이 파일 자체는 Git에 커밋해도 됩니다 (개인 설정이 아니라 "팀 권장 목록"이기 때문).

---

## 4. T003 — GitHub 레포지토리 연결 확인

```bash
git remote -v
git status
```

결과:
```
origin  https://github.com/ssstriples/lsh_blog.git (fetch)
origin  https://github.com/ssstriples/lsh_blog.git (push)
On branch main
Your branch is up to date with 'origin/main'.
```

> 💡 **초보자 Tip**: `git remote -v`는 "내 로컬 저장소가 어떤 원격 주소와 연결되어 있는지" 보여줍니다.
> 새 프로젝트라면 GitHub에서 빈 저장소를 만들고 `git remote add origin <url>`로 연결합니다.

---

## 5. T004 — `.gitignore` 작성

### 왜 필요한가?
- `node_modules`처럼 용량이 크고 재설치 가능한 폴더를 Git에 올리면 저장소가 무거워짐
- `.env` 같은 **비밀번호/API 키가 담긴 파일**이 실수로 GitHub에 올라가면 심각한 보안 사고로 이어짐

### 작성한 `.gitignore` 핵심 항목

```gitignore
# Dependencies
node_modules/

# Environment variables (절대 커밋 금지!)
.env
.env.local
.env.*.local
!.env.example
*.pem

# Next.js
.next/
out/

# Build outputs
dist/
build/

# Logs
logs/
*.log

# Prisma
prisma/*.db

# Editor / OS
.DS_Store
Thumbs.db
```

> ⚠️ **중요**: `.env.example`은 예외로 남겨둡니다 (`!.env.example`).
> 이 파일에는 실제 값이 아니라 "어떤 환경변수가 필요한지 이름만" 적어서 커밋하고,
> 팀원이 이를 복사해서 `.env`를 직접 채우도록 안내하는 용도입니다.

---

## 6. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 터미널에서 `node: command not found` | bash 세션이 PATH를 아직 못 읽음 | `which node`로 실제 경로 확인 후 재시도, 또는 새 터미널 열기 |

---

## 7. 완료 체크리스트

- [x] Node/pnpm 버전 확인 및 문서화
- [x] `.vscode/extensions.json` 작성
- [x] GitHub 원격 저장소 연결 확인
- [x] `.gitignore` 작성 (env, node_modules, next 빌드 산출물 포함)

## 8. 다음 단계

→ [Phase 0-2 프론트엔드 스캐폴딩](./2026-08-07_phase0-2_nextjs-scaffolding.md)
