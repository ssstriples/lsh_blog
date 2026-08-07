# ✍️ 블로그 게시글 원고 (Markdown)

> 이 폴더는 실제로 `lsh_blog` 사이트에 발행할 게시글의 **Markdown 원고**를 보관합니다.
> 나중에 관리자 페이지(TipTap 에디터)에서 이 내용을 불러오거나,
> 마이그레이션 스크립트로 DB의 `Post.content`에 넣는 용도로 사용합니다.

## 작성 규칙

### 1. 파일명
`YYYY-MM-DD-slug-형식-제목.md`

### 2. Frontmatter (문서 최상단 메타데이터)

```yaml
---
title: "게시글 제목"
slug: "url-에-들어갈-slug"
date: "YYYY-MM-DD"
category: "카테고리명"
tags: ["태그1", "태그2"]
status: "DRAFT" # DRAFT | PUBLISHED
summary: "목록 페이지에 보여줄 한 줄 요약"
---
```

### 3. 글쓰기 원칙 (초보자 친화)

- 전문 용어가 나오면 **바로 다음 줄이나 인용구(`>`)로 짧게 풀이**를 덧붙인다.
- "왜 이 기술/방법을 선택했는지"를 반드시 설명한다 (단순 나열 금지).
- 실행한 명령어, 실제 코드 diff, 마주친 에러와 해결 과정을 그대로 남긴다 (트러블슈팅 섹션).
- 시리즈물은 글 마지막에 "다음 편 예고"를 남겨 연속성을 준다.
- `docs/dev-log/`의 상세 개발 로그를 기반으로 하되, 독자가 읽기 편하도록 다듬어서 재구성한다.

## 게시글 목록

| 파일 | 제목 | 상태 |
|------|------|------|
| [2026-08-07-build-my-blog-01-dev-environment-nextjs-setup.md](./2026-08-07-build-my-blog-01-dev-environment-nextjs-setup.md) | 기술 블로그를 직접 만들어보자 #1 — 개발 환경부터 Next.js 다크모드까지 | DRAFT |
| [2026-08-07-build-my-blog-02-express-backend-security-middlewares.md](./2026-08-07-build-my-blog-02-express-backend-security-middlewares.md) | 기술 블로그를 직접 만들어보자 #2 — Express 서버에 보안 미들웨어 5종 세트 붙이기 | DRAFT |
