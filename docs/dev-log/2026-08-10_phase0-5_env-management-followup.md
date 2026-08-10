# Phase 0-5: 환경변수 관리 마무리 (T018~T020-S3)

> 관련 태스크: `T018`, `T019`, `T020`, `T020-S`, `T020-S2`, `T020-S3`
> 작업일: 2026-08-10
> 결과물 위치: `frontend/.env.local`, `frontend/.env.example`, `frontend/.gitignore`, `backend/.env.example`

## 1. 배경

Phase 0-3(백엔드), 0-4(DB) 작업 중에 `backend/.env`, `backend/.env.example`,
`validateEnv.ts`, JWT 시크릿 등은 이미 만들어져 있었지만, `tasks.md`에는
체크 표시가 누락되어 있었다. 이번에 Phase 3 진행 전 전체 태스크 목록을
다시 점검하며 **프론트엔드 쪽 환경변수(T018)가 아직 없다는 것**을 발견해
마저 작업했다.

---

## 2. T018 — `frontend/.env.local` 생성

프론트엔드는 아직 NextAuth(T039, Phase 2-3)를 붙이지 않은 상태라 당장
`NEXTAUTH_SECRET`이 필요하지는 않지만, 백엔드 API 서버 주소는 지금부터도
필요하므로 우선 추가했다.

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4100
```

`NEXT_PUBLIC_` 접두사는 Next.js 규칙으로, 이 접두사가 붙은 환경변수만
브라우저(클라이언트) 코드에서 접근 가능하다. API URL은 클라이언트에서
fetch할 때 필요하므로 이 접두사가 필요하다.

`NEXTAUTH_SECRET`, `NEXTAUTH_URL`은 실제로 NextAuth를 설치하는 T039 시점에
추가하기로 하고, `.env.example`에는 미리 주석으로 안내만 남겨두었다.

---

## 3. T020 — `frontend/.env.example` 작성

```bash
# 백엔드 API 서버 주소 (Express, 기본 포트 4100)
NEXT_PUBLIC_API_URL=http://localhost:4100

# NextAuth 설정 (Phase 2-3 프론트엔드 인증 구현 시 사용 — T039)
# NEXTAUTH_SECRET=
# NEXTAUTH_URL=http://localhost:3000
```

---

## 4. T020-S — 트러블슈팅: `.env.example`이 git에 안 잡히는 문제

`.gitignore`에 `.env*`, `*.pem`이 잘 들어있는지 확인하는 과정에서,
**`frontend/.gitignore`의 `.env*` 규�식이 `.env.example`까지 가려버리는
문제**를 발견했다. (`create-next-app`이 기본 생성한 `.gitignore`에는
`.env.example`에 대한 예외 처리가 없었다.)

```bash
$ git check-ignore -v frontend/.env.example
frontend/.gitignore:34:.env*    frontend/.env.example   # ← .env.example까지 무시되고 있었음!
```

`backend/.gitignore`는 별도 파일이 없고 루트 `.gitignore`(Phase 0-1에서 작성)의
`!.env.example` 예외 규칙이 적용되어 정상이었지만, `frontend/`는 Next.js
스캐폴딩이 자체 `.gitignore`를 생성하면서 이 부분이 누락되어 있었다.

**해결**: `frontend/.gitignore`에 예외 규칙 추가.

```diff
 # env files (can opt-in for committing if needed)
 .env*
+!.env.example
```

수정 후 재검증:
```bash
$ git check-ignore -v frontend/.env.example frontend/.env.local backend/.env
frontend/.gitignore:35:!.env.example    frontend/.env.example   # 이제 추적 가능
frontend/.gitignore:34:.env*            frontend/.env.local     # 여전히 무시됨 (정상)
.gitignore:6:.env                       backend/.env            # 여전히 무시됨 (정상)
```

`*.pem` 규칙도 함께 재검증했다 (`backend/`에 테스트용 `.pem` 파일을 만들어
`git check-ignore`로 확인 후 삭제).

---

## 5. T020-S2, T020-S3 재검증

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`은 각각 96자리 hex 랜덤 값으로,
  서로 다른 값임을 재확인했다 (Phase 0-3에서 이미 생성됨).
- `validateEnv.ts`의 `REQUIRED_ENV_VARS`에 `PORT`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `DATABASE_URL` 5개 항목이 모두
  포함되어 있음을 재확인했다 (Phase 0-4에서 `DATABASE_URL` 추가 완료).

---

## 6. 최종 빌드 검증

프론트엔드/백엔드 모두 최신 상태로 빌드가 정상 통과하는지 확인했다.

```bash
# frontend
$ pnpm run build
✓ Compiled successfully
✓ Environments: .env.local   # .env.local이 정상적으로 로드됨을 로그로 확인

# backend
$ pnpm run build
> tsc -p tsconfig.json   # 에러 없이 통과
```

---

## 7. 배운 점

- 프레임워크가 자동 생성하는 `.gitignore`(예: `create-next-app`)를 프로젝트
  루트의 `.gitignore` 컨벤션과 혼용할 때는, **하위 디렉토리의 `.gitignore`가
  상위 규칙과 별개로 독립적으로 적용된다**는 점을 놓치기 쉽다.
  `git check-ignore -v <파일>`로 "어느 `.gitignore`의 몇 번째 줄이 이 파일을
  걸렀는지"를 확인하는 습관이 중요하다.
- 태스크를 다음 Phase로 넘어가기 전에, 지나간 Phase의 체크리스트를 다시
  훑어보는 것만으로도 이런 "완료했지만 표시가 안 된 항목"이나 "빠뜨린 하위
  항목"을 발견할 수 있다.
