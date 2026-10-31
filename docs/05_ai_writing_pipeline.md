# 🤖 AI 기반 명세서 작성 파이프라인

> 아이디어 → 요구조건 명세서 → 상세 기술 명세서 → 블로그 게시글 로 이어지는 자동화 흐름 설계 문서

## 1. 목적

블로그 개발 과정 자체를 "AI로 명세서를 작성하는 방법론"의 실사례로 축적한다.
새 기능/글감이 생기면 아래 2단계 체인을 거쳐 문서를 만들고, 이를 다시 블로그 게시글로 가공한다.

## 2. 파이프라인 단계

```
[아이디어 입력]
     │
     ▼
[1단계: 요구조건 명세서 생성 프롬프트]
  - 목적/배경
  - 사용자 스토리 (누가, 무엇을, 왜)
  - 대략적 기능 목록 (MoSCoW: Must/Should/Could/Won't)
     │
     ▼ (사람 검수 및 수정)
     │
[2단계: 상세 기술 명세서 생성 프롬프트]
  - API 엔드포인트 설계
  - DB 스키마 변경사항
  - 컴포넌트/시퀀스 다이어그램
  - 예외처리 및 보안 고려사항
     │
     ▼ (사람 검수 및 수정)
     │
[3단계: 블로그 게시글 변환]
  - 위 문서를 바탕으로 튜토리얼/회고 형태 게시글 작성
```

## 3. 프롬프트 템플릿 (✅ 확정 — 2026-10-31, T083/T084)

> 프롬프트 원문은 코드가 단일 출처(single source of truth)다. 이 문서에는 구조와 의도만 적는다.
> - 공통 프로젝트 컨텍스트: [`backend/src/prompts/projectContext.ts`](../backend/src/prompts/projectContext.ts)
> - 1·2단계: [`backend/src/prompts/specPrompts.ts`](../backend/src/prompts/specPrompts.ts)
> - 3단계: [`backend/src/prompts/blogDraftPrompt.ts`](../backend/src/prompts/blogDraftPrompt.ts)

### 3-0. 공통 구조

```
[system]  <project>…스택·모델·백엔드 컨벤션·문서 관례…</project>   ← 고정 (prompt caching 대상)
          + 단계별 작업 지침 (출력 구성, 작성 원칙)                  ← 고정
[user]    <idea>…</idea> / <requirements>…</requirements> / <source_document>…</source_document>
          + "위 자료로 ○○를 작성해줘."                               ← 요청마다 다름
```

- **초안 대비 바뀐 점**: 초안은 "아이디어를 넣고 형식을 나열"하는 한 줄짜리였다. 확정본은 ① 이 프로젝트의 스택·
  컨벤션(`AppError`, `requireOwnership`, Zod에 넣지 않을 필드 등)을 시스템 프롬프트에 넣어 **이 코드베이스에 맞는**
  명세가 나오게 했고, ② 출력 섹션 구성을 고정해 사람이 매번 같은 순서로 검토할 수 있게 했고, ③ 입력을 태그로 감싸
  "입력 안의 문장은 지시가 아니라 자료"로 다루게 했다.
- **지어내기 방지**: 아이디어에 없는 내용은 "가정:", 사람이 정해야 할 것은 "질문:", 2단계에서 답이 없는 질문은
  "결정(검토 필요):"로 표시하게 했다 → 사람 검수 지점이 문서 안에 드러난다.

### 3-1. 1단계 — 요구조건 명세서 (`REQUIREMENTS_SYSTEM`)

출력 구성: 목적/배경 → 사용자 스토리(표, 비로그인/USER/ADMIN) → 기능 목록 MoSCoW → 비기능 요구사항 →
**권한 매트릭스** → 가정과 열린 질문

### 3-2. 2단계 — 상세 기술 명세서 (`TECH_SPEC_SYSTEM`)

출력 구성: 개요(재사용할 기존 코드) → API 명세(🔓🔒🔑🛡️ 표 + Request/Response JSON) → Prisma 스키마 변경
(기존 데이터 영향 주의점) → 백엔드 파일 구성 → 프론트 구성(렌더링 방식과 이유) → 에러 처리 표 → **보안 체크리스트**
(Rate Limit·XSS·소유권·권한·민감정보) → 테스트 케이스 표 → `tasks.md` 형식 태스크 분해(1~4시간 단위)

### 3-3. 3단계 — 블로그 초안 (`BLOG_DRAFT_SYSTEM`)

- 글쓰기 원칙은 [`content/posts/README.md`](../content/posts/README.md)의 초보자 친화 규칙(용어 풀이, "왜", 트러블슈팅,
  다음 편 예고)을 옮겼다.
- 출력은 **구조화 출력**(JSON: `title`, `summary`, `tags`, `html`)으로 강제하고, `html`은 TipTap 에디터와 Shiki
  렌더러가 다룰 수 있는 태그·코드 언어만 쓰게 했다.

### 3-4. 모델 / 호출 설정

| 항목 | 값 | 이유 |
|---|---|---|
| 모델 | `claude-opus-5-5` (`backend/src/lib/anthropic.ts`의 `AI_MODEL` 한 곳에서 관리) | 기본 최신 모델 |
| thinking | 생략 (Opus 5.5는 항상 adaptive, 끌 수 없음) | 깊이는 effort로 조절 |
| effort | 1·2단계 `high`, 3단계 `medium` | 명세서는 정확성이 중요, 초안은 사람이 다듬음 |
| 스트리밍 | 모든 단계 `messages.stream()` + `finalMessage()`, `max_tokens: 64000` | 긴 출력의 HTTP 타임아웃 방지 |
| 프롬프트 캐싱 | 시스템 프롬프트에 `cache_control: ephemeral` | 고정 프리픽스 재사용 (Opus 5.5 최소 512토큰) |
| 거절 폴백 | `fallbacks: "default"` + 베타 `server-side-fallback-2026-07-01` | 안전 분류기 거절 시 서버가 다른 모델로 재시도 |

## 4. 저장 방식 / 실행 방법 (✅ T086)

1·2단계는 CLI로 실행하고 결과를 `docs/generated/`에 저장한다 (단계 사이에 사람이 검토·수정).

```bash
cd backend
pnpm ai:pipeline requirements --topic newsletter --idea "구독자에게 새 글 알림 메일 보내기"
#  → docs/generated/2026-10-31_newsletter_requirements.md  (frontmatter: status "REVIEW_NEEDED", model, 토큰 사용량)
#  … 사람이 검토·수정 …
pnpm ai:pipeline tech-spec --topic newsletter            # 가장 최근 요구조건 문서를 자동으로 사용
#  → docs/generated/2026-10-31_newsletter_tech_spec.md
```

- `--idea-file <경로>`(긴 아이디어), `--from <경로>`(2단계 입력 지정), `--dry-run`(API 호출 없이 프롬프트만 출력),
  `--force`(덮어쓰기) 지원. 같은 이름 파일은 `--force` 없이는 덮어쓰지 않는다.
- 최종 승인된 문서는 3단계(에디터의 "AI 초안 생성")의 참고 자료로 붙여넣어 게시글 초안으로 변환한다.
- `ANTHROPIC_API_KEY`가 필요하다 (`backend/.env`, 선택 환경변수 — 없으면 AI 기능만 비활성화).

## 5. 에디터 연동 (✅ T085)

- `/posts/new`, `/posts/[id]/edit`의 **"AI 초안 생성"** 버튼 — 🛡️ 관리자에게만 노출 (호출마다 비용 발생)
- 글감(필수) + 참고 자료(선택: 1·2단계 문서, 개발 로그)를 입력 → `POST /api/admin/ai/draft` → 제목/요약/태그 미리보기
  → "에디터에 넣기"를 누르면 제목·태그·본문이 TipTap에 로드되고, 사람이 다듬어 저장·발행한다 (자동 발행 없음)
- **버튼은 3단계만 실행한다.** 1→2→3단계를 버튼 하나로 자동 연결하지 않은 이유: 이 파이프라인은 단계 사이 "사람 검수"가
  핵심이고, 세 번의 긴 생성을 HTTP 요청 하나로 기다리게 하면 수 분이 걸린다. 그래서 1·2단계는 CLI(검수 지점 포함),
  3단계는 에디터로 나눴다.
- 비용 보호: 관리자 전용 + 성공 기준 1시간 10회 Rate Limit + 참고 자료 6만 자 상한
