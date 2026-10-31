# 🤖 AI 생성 문서 (docs/generated)

[`docs/05_ai_writing_pipeline.md`](../05_ai_writing_pipeline.md)의 파이프라인 1·2단계 결과물을 저장하는 폴더입니다.
CLI가 자동으로 파일을 만들고, **사람이 검토·수정한 뒤** 다음 단계로 넘깁니다.

## 만드는 방법

```bash
cd backend
pnpm ai:pipeline requirements --topic <topic> --idea "<아이디어>"   # 1단계
pnpm ai:pipeline tech-spec   --topic <topic>                      # 2단계 (가장 최근 요구조건 문서 사용)
```

옵션: `--idea-file`, `--from`, `--dry-run`(API 호출 없이 프롬프트 확인), `--force`(덮어쓰기)

## 파일 규칙

| 파일 | 단계 |
|---|---|
| `YYYY-MM-DD_{topic}_requirements.md` | 1단계 — 요구조건 명세서 |
| `YYYY-MM-DD_{topic}_tech_spec.md` | 2단계 — 상세 기술 명세서 |

- `topic`: 영문 소문자·숫자·하이픈 (예: `newsletter`)
- 각 파일 맨 위 frontmatter에 `status`(`REVIEW_NEEDED` → 검토 후 `REVIEWED`로 직접 변경), 사용 모델, 생성 시각,
  입력 출처, 토큰 사용량이 기록됩니다. 다음 단계는 frontmatter를 떼고 본문만 입력으로 사용합니다.

## 다음 단계

검토가 끝난 문서는 글쓰기 화면의 **"AI 초안 생성"**(관리자 전용) → "참고 자료"에 붙여넣어 블로그 초안(3단계)으로 바꿉니다.
