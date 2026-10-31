# Phase 5: 검색 & 좋아요 & 관리자 대시보드/회원 관리 (T076~T082-S3)

> 관련 태스크: `T076`, `T077`, `T078`, `T079`, `T080`, `T081`, `T082`, `T082-S`, `T082-S2`, `T082-S3`
> 작업일: 2026-10-31
> 결과물 위치:
> - DB: `backend/prisma/schema.prisma` (`PostLike @@unique([postId, guestId])`, `PostView @@index([viewedAt])`),
>   `backend/prisma/migrations/20261031000023_add_like_guest_unique_view_index/`
> - 백엔드: `backend/src/routes/searchRoutes.ts`, `backend/src/services/{likeService,dashboardService,userAdminService}.ts`,
>   `backend/src/controllers/{likeController,adminController}.ts`, `backend/src/schemas/adminSchema.ts`,
>   `backend/src/middlewares/{likeRateLimiter,authMiddleware}.ts`(`requireActiveUser`),
>   `backend/src/services/postService.ts`(`searchPosts`), `backend/src/routes/{postRoutes,adminRoutes}.ts`
> - 프론트: `frontend/src/app/search/page.tsx`, `frontend/src/components/search/SearchResults.tsx`,
>   `frontend/src/components/post/LikeButton.tsx`, `frontend/src/hooks/{useSearch,useLike,useAdmin}.ts`,
>   `frontend/src/app/admin/{layout,page}.tsx`, `frontend/src/app/admin/users/page.tsx`,
>   `frontend/src/components/admin/{AdminNav,DashboardView,ViewTrendChart,AdminUserList}.tsx`, `frontend/src/types/admin.ts`

---

## 1. 목표

| 기능 | 내용 |
|---|---|
| 검색 | 제목+본문 ILIKE 검색 API + `/search` 화면 |
| 좋아요 | 로그인 없이도 누를 수 있는 토글 (게스트는 쿠키 기준 1회) |
| 대시보드 | 총계 KPI + 14일 조회수 추이 차트(Recharts) + 인기글 Top5 + 최근 댓글 |
| 회원 관리 | 전체 회원 목록 + 정지/해제 (정지 즉시 글쓰기/댓글 차단) |

---

## 2. 설치한 패키지 / DB 변경

```bash
# frontend/
pnpm add recharts   # 3.10.1
```

| 패키지 | 버전 | 역할 |
|---|---|---|
| `recharts` | 3.10.1 | 대시보드 조회수 추이 차트 (v3부터 `accessibilityLayer` 기본 활성 → 키보드로도 툴팁 조작) |

DB에는 인덱스 2개를 추가했다.

```sql
-- CreateIndex
CREATE UNIQUE INDEX "post_likes_postId_guestId_key" ON "post_likes"("postId", "guestId");
-- CreateIndex
CREATE INDEX "post_views_viewedAt_idx" ON "post_views"("viewedAt");
```

unique 인덱스를 추가하기 전에, 이미 중복된 게스트 좋아요가 있으면 마이그레이션이 실패하므로
먼저 확인했다 (중복이 있으면 예외를 던지는 SQL — "Script executed successfully" = 중복 없음).

```bash
npx prisma db execute --stdin <<'EOF'
DO $$ DECLARE n int; BEGIN SELECT COUNT(*) INTO n FROM (SELECT 1 FROM "post_likes" WHERE "guestId" IS NOT NULL GROUP BY "postId","guestId" HAVING COUNT(*)>1) t; IF n > 0 THEN RAISE EXCEPTION 'duplicate guest likes: %', n; END IF; END $$;
EOF
```

마이그레이션 생성 과정의 문제는 트러블슈팅 5-1 참고.

---

## 3. 핵심 설계 결정과 코드

### 3-1. 검색 (T076, T077) — ILIKE + "검색어 주변 미리보기"

Prisma의 `contains` + `mode: "insensitive"`가 Postgres `ILIKE '%q%'`로 변환된다. 공개 목록의
`q` 필터와 같은 방식이지만, 검색 결과 화면에는 **"어디가 걸렸는지"**를 보여줘야 해서 별도
`searchPosts`를 만들었다.

```ts
// services/postService.ts
const posts = rows.map(({ content, ...post }) => ({ ...post, excerpt: buildExcerpt(content, q) }));
```

- 본문(HTML) 전체를 응답에 싣지 않고, 태그를 걷어내고 엔티티를 디코딩한 평문에서 **검색어 앞뒤
  60자**만 잘라 `excerpt`로 내려준다 (응답 크기 ↓, HTML 노출 ↓).
- 본문에 없고 제목에만 걸리면 본문 앞부분을 보여준다.
- 화면의 하이라이트는 `dangerouslySetInnerHTML` 없이, 문자열을 검색어 기준으로 나눠 일치 부분만
  `<mark>`로 감싸 React 텍스트로 렌더링한다 → 검색어나 본문에 `<script>`가 있어도 HTML로 해석될 일이 없다.
- ⚠️ 알려진 한계: 본문이 HTML이라 태그/속성 이름(예: `class`)으로 검색해도 걸릴 수 있다. 글이 많아지면
  평문 컬럼을 따로 두거나 Postgres 전문 검색(`tsvector`)으로 바꾸는 것을 고려한다 (코드 주석에 남김).
- 페이지를 넘길 때 결과가 사라졌다 나타나지 않도록 TanStack Query `placeholderData: keepPreviousData`로
  이전 결과를 흐리게 유지한다.

### 3-2. 좋아요 (T078, T079) — "누구"를 어떻게 식별할 것인가

| 사용자 | 식별 기준 | 이유 |
|---|---|---|
| 로그인 | `userId` | 기기가 바뀌어도 같은 사람 |
| 비로그인 | 서버가 발급한 `guestId` 쿠키 | 요구사항 "쿠키 기반 guestId" |

```ts
// controllers/likeController.ts
const guestIdCookieOptions: CookieOptions = {
  httpOnly: true,                 // JS에서 읽을 필요 없음 — 서버만 식별용으로 사용
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",                // :3000 ↔ :4100은 포트만 다른 "같은 사이트"
  path: "/api/posts",             // 좋아요 라우트에만 실려 가도록 범위를 좁힌다
  maxAge: 365 * 24 * 60 * 60 * 1000,
};
```

- **ID는 서버가 만든다** (`crypto.randomUUID()`). 클라이언트가 보낸 쿠키 값은 UUID 형식일 때만 믿고,
  아니면 무시하고 새로 발급한다 → 임의 문자열로 남의 좋아요를 흉내 낼 수 없다.
- 프론트(:3000) → 백엔드(:4100)는 cross-origin fetch라 **`credentials: "include"`**가 있어야 쿠키가
  오간다 (백엔드 CORS는 이미 `credentials: true` + 허용 출처 명시).
- ⚠️ 배포 시 프론트/백엔드 도메인이 서로 다르면(cross-site) `SameSite=None; Secure`로 바꿔야 한다 — Phase 8 메모.
- **동시 클릭**: 같은 사람이 거의 동시에 두 번 누르면 두 요청 모두 "아직 안 눌렀음"을 보고 생성을
  시도할 수 있다. unique 제약이 두 번째를 막고(`P2002`), 서비스는 이를 에러가 아니라 "좋아요 상태"로 응답한다.
- **UI**: 낙관적 업데이트(누르는 즉시 하트/숫자 변경) → 실패 시 롤백, 성공 시 서버 값으로 보정.
  로그인/로그아웃하면 식별 기준이 바뀌므로 쿼리 키에 사용자 id를 넣어 다시 조회한다.
- ⚠️ 알려진 한계: 게스트는 쿠키를 지우면 다시 누를 수 있다. 막을 수는 없으니 토글 Rate Limit(30회/1분, IP)으로
  부풀리기 속도만 늦춘다.

### 3-3. 대시보드 API (T080) — 숫자의 기준을 맞추기

```ts
// services/dashboardService.ts (요약)
totals: { users, posts, views: sum(post.viewCount), comments }
popularPosts: viewCount 상위 5 (+ likeCount, commentCount)
recentComments: 최신 5
viewTrend: 최근 14일(KST) 일별 조회수
```

**일별 조회수를 어디서 세나?** `Post.viewCount`는 누적값이라 날짜별로 나눌 수 없다. 대신 조회 중복
방지용으로 만들어둔 `PostView`(게시글+IP 해시의 **첫 조회** 기록, `viewedAt`)를 날짜별로 센다.
`viewCount`도 `PostView`가 새로 생길 때만 +1 되므로 두 숫자는 같은 기준이다 (화면에도
"게시글별 첫 방문 기준"으로 표기).

```ts
prisma.$queryRaw<{ day: string; count: bigint }[]>`
  SELECT TO_CHAR((pv."viewedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
         COUNT(*)::bigint AS count
  FROM "post_views" pv
  JOIN "posts" p ON p."id" = pv."postId"
  WHERE pv."viewedAt" >= ${since} AND p."deletedAt" IS NULL
  GROUP BY day
  ORDER BY day`
```

- **시간대**: Prisma는 `DateTime`을 UTC로, 시간대 없는 `timestamp`에 저장한다. 그래서 "UTC로 해석 → KST로
  변환" 두 단계를 거쳐 한국 자정 기준으로 날짜를 나눈다.
- **날짜는 문자열로** 받는다 (`TO_CHAR`). `date` 타입으로 받으면 pg 드라이버가 서버 로컬 시간대의 JS `Date`로
  바꿔 하루가 밀릴 수 있다.
- **빈 날은 0으로 채운다.** 조회가 없던 날이 빠지면 차트의 x축 간격이 들쭉날쭉해진다.
- **삭제된 글은 모든 숫자에서 제외** — 처음엔 추이에만 섞여 들어가 총계와 어긋났다 (트러블슈팅 5-2).

### 3-4. 대시보드 화면 (T081, T082) — dataviz 스킬 절차대로

차트를 그리기 전에 dataviz 스킬의 절차(형태 → 색 → **검증 스크립트 실행** → 마크 규격 → 호버 → 접근성
→ **렌더링해서 눈으로 확인**)를 따랐다.

1. **형태**: 총계 4개는 차트가 아니라 **KPI 타일**. "시간에 따른 추이" + 단일 시리즈 → **영역(area) 차트**.
2. **색**: 단일 시리즈 = 순차(sequential) 기본 색인 blue 하나. 범례 상자는 두지 않는다 — 제목
   ("일별 조회수 (최근 14일)")이 무엇을 그렸는지 말한다.
3. **검증**: 팔레트 기본 표면이 아니라 **실제로 차트가 놓이는 Card 표면**으로 검증했다.

   ```bash
   node scripts/validate_palette.js "#2a78d6" --mode light --surface "#ffffff"   # → ALL CHECKS PASS
   node scripts/validate_palette.js "#3987e5" --mode dark  --surface "#171717"   # → ALL CHECKS PASS
   ```

   (shadcn `--card`: 라이트 `oklch(1 0 0)` = #fff, 다크 `oklch(0.205 0 0)` ≈ #171717)
4. **마크**: 2px 선, 면은 시리즈 색 10% 투명도, 그리드는 실선 hairline(점선 X), 끝점만 8px 점 + 2px 표면색 링,
   끝값을 **본문 잉크 색**으로 직접 라벨링(시리즈 색 글자 X).
5. **호버**: 크로스헤어(세로 hairline이 가장 가까운 날짜에 붙음) + 툴팁은 **값이 굵게 먼저**, 날짜는 보조,
   시리즈 표시는 박스가 아닌 짧은 선. Recharts 3는 키보드 포커스로도 툴팁이 뜬다.
6. **접근성**: "표로 보기"(`<details>` 테이블)로 툴팁 없이도 모든 값 확인 가능.
7. **눈으로 확인**: 스크린샷을 찍어보니 `monotone` 곡선이 날짜 사이를 부드럽게 이어 **존재하지 않는 중간값**을
   암시해서, 일별 이산 값에 맞게 `linear`로 바꿨다.

색은 컴포넌트에 하드코딩하지 않고 `globals.css`의 `.viz-root` CSS 변수로 두고, next-themes가 `<html class="dark">`를
붙이는 방식에 맞춰 `.dark .viz-root`에서 다크 값으로 바꾼다.

관리자 화면이 4개(대시보드/게시글/댓글/회원)가 되어 `app/admin/layout.tsx` + `AdminNav` 탭으로 묶었다.

### 3-5. 회원 관리 (T082-S~S3) — 정지는 "즉시" 효과가 있어야 한다

```ts
// services/userAdminService.ts
if (actor.id === targetId) throw new AppError("본인 계정의 상태는 변경할 수 없습니다.", 400);
if (target.role === "ADMIN") throw new AppError("관리자 계정은 정지할 수 없습니다.", 403);
// ...
logger.warn(`[관리자] 회원 상태 변경: ${target.email} (${targetId}) → ${status} by ${actor.id}`);
```

- 본인 정지 금지(관리자가 사라지는 사고 방지), 다른 관리자 정지 금지(관리자끼리 다툼 방지 — 강등은 DB에서 직접).
- `updateUserStatusSchema`에는 `status`만 있다. 바디에 `role: "ADMIN"`을 끼워 넣어도 Zod가 버린다 (테스트로 확인).
- 목록 응답에 `password`는 select하지 않는다.

**정지의 효과를 점검**하다가 구멍을 발견했다.

| 경로 | 정지 계정 차단 여부 (작업 전) |
|---|---|
| 로그인 | ✅ (`authService`) |
| Access Token 재발급 | ✅ (`authController.refresh`) |
| 댓글 작성 | ✅ (Phase 4에서 DB 재확인) |
| **글쓰기/수정/삭제/이미지 업로드** | ❌ — Access Token(15분)이 살아있으면 통과 |

`requireAuth`는 토큰만 검증하고, 토큰은 발급 당시 정보다. 그래서 쓰기 라우트에 DB에서 현재 상태를
다시 확인하는 미들웨어를 추가했다.

```ts
// middlewares/authMiddleware.ts
export async function requireActiveUser(req, _res, next) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { status: true, deletedAt: true } });
  if (!user || user.deletedAt) throw new AppError("로그인이 필요합니다.", 401);
  if (user.status === "SUSPENDED") throw new AppError("정지된 계정입니다. 관리자에게 문의해주세요.", 403);
  next();
}

// routes/postRoutes.ts
router.post("/", requireAuth, requireActiveUser, create);
router.patch("/:id", requireAuth, requireActiveUser, ownershipCheck, update);
// ... status / delete / upload-image 동일
```

모든 요청에 DB 조회를 붙이면 읽기까지 느려지므로 **쓰기 라우트에만** 적용했다. 삭제도 포함했는데,
정지된 계정이 모더레이션 중인 자기 글을 지워 증거를 없애는 것을 막기 위해서다.

UI(`AdminUserList`)에서는 상태 배지를 색만이 아니라 **아이콘 + 글자**("⊘ 정지", "✓ 활성")로 표시하고,
본인/관리자 계정은 버튼 대신 "본인 계정"/"관리자 계정" 사유를 보여준다. 정지 confirm에는 "로그인과 글·댓글
작성이 차단됩니다"라는 효과를 함께 안내한다.

---

## 4. 테스트

### 4-1. Phase 5 API (34/34 통과)

테스트용 계정 2개를 SQL로 임시 ADMIN 승격 → `finally`에서 USER/ACTIVE로 원복 (Phase 4와 같은 방식).

```
PASS  search: case-insensitive body match, DRAFT excluded  — n=1
PASS  search: excerpt is plain text around match (no tags, entities decoded)  — "앞부분 문장입니다. 여기에 zebrafish… 라는 단어가 있습니다 & 끝."
PASS  search: title match (Korean)
PASS  search: missing q → 400 (Korean message), q > 100 chars → 400  — 검색어를 입력해주세요.
PASS  like: guest without cookie → liked=false, count=0, no cookie set
PASS  like: guest first toggle → liked, sets HttpOnly guestId cookie (path=/api/posts)  —  Max-Age=31536000; Path=/api/posts; …; HttpOnly; SameSite=Lax
PASS  like: guest with cookie → liked=true
PASS  like: guest toggle again → unliked, count=0
PASS  like: logged-in user counted by account (not guest cookie) → count=2
PASS  like: forged/invalid guestId ignored → new cookie issued, count=3
PASS  like: DRAFT post → 404
PASS  dashboard: 200 with numeric totals
PASS  dashboard: viewTrend = 14 consecutive days ending today (KST), today ≥ 1
PASS  dashboard: 14-day trend total ≤ totals.views (deleted posts' views excluded from both)  — trend=1 total=1
PASS  dashboard: viewTrend sorted ascending, zero-filled
PASS  dashboard: popularPosts ≤ 5 with author/likeCount/commentCount, sorted by views
PASS  dashboard: recentComments newest first includes ours
PASS  dashboard: USER → 403
PASS  users: search by email → postCount/commentCount, no password field  — {"postCount":2,"commentCount":1}
PASS  users: invalid status filter → 400
PASS  users: USER → 403
PASS  users: suspend B → 200 SUSPENDED
PASS  users: status=SUSPENDED filter includes B
PASS  suspended B (valid token): create post → 403 (requireActiveUser)  — 정지된 계정입니다. 관리자에게 문의해주세요.
PASS  suspended B: comment → 403
PASS  suspended B: login → 403  — 이용이 정지된 계정입니다. 문의사항은 관리자에게 연락해주세요.
PASS  users: suspend self → 400  — 본인 계정의 상태는 변경할 수 없습니다.
PASS  users: suspend another ADMIN → 403  — 관리자 계정은 정지할 수 없습니다.
PASS  users: extra 'role' in body is ignored (A stays USER)
PASS  users: unknown user → 404
PASS  users: unsuspend B → 200, B can log in again
PASS  deleted post's comments: gone from recentComments, totals.comments decreases  — 1 → 0
PASS  deleted post's comments: excluded from /api/admin/comments
PASS  cleanup: temp admins demoted to USER  — USER/USER
```

공유 코드(게시글 쓰기 라우트, 관리자 댓글 목록)를 바꿨기 때문에 이전 Phase 테스트도 다시 돌렸다:
Phase 3-5 API **17/17**, Phase 4 댓글 API **23/23** 통과.

### 4-2. 화면 — 실제 브라우저 렌더링 확인

이번엔 처음으로 실제 브라우저 화면을 확인했다. 프로젝트가 아닌 별도 임시 폴더에 `puppeteer-core`만 설치하고,
PC에 깔린 Chrome을 headless로 띄워 NextAuth 세션 쿠키를 심은 뒤 스크린샷을 찍었다.

```bash
# (임시 폴더에서)
npm i puppeteer-core@24
node shoot.mjs     # /admin(라이트·다크·호버·모바일 390px), /admin/users, /posts/[slug](다크), /search
node console.mjs   # 각 페이지의 console.error / pageerror 수집
```

추이 차트가 오늘 하루치뿐이면 모양을 확인할 수 없어서, 임시 게시글 1개에 지난 13일치 `post_views`를 넣었다가
`finally`에서 **해당 행을 삭제하고 글은 소프트 삭제, 임시 관리자는 USER로 원복**했다.

확인한 것: 라이트/다크 모두 차트 대비 정상, 크로스헤어 툴팁, 끝값 라벨, 모바일에서 KPI 2열·차트 축 라벨 겹침 없음,
회원 목록의 본인 계정 잠금, 상세 페이지 좋아요 버튼 위치, 검색 하이라이트. **브라우저 콘솔 에러 0건**(수정 후).

### 4-3. 정적 검사/빌드

```bash
cd backend  && npx tsc -p tsconfig.json --noEmit        # 통과
cd frontend && npx next typegen && npx tsc --noEmit -p tsconfig.json && npx eslint <변경 파일>   # 통과
cd frontend && npx next build                            # 성공 (/admin ○, /admin/users ƒ, /search ƒ)
```

---

## 5. 트러블슈팅

### 5-1. `prisma migrate dev --create-only`가 비대화형 환경에서 거부됨

```
`prisma migrate dev` is an interactive command designed to create new migrations and evolve the database in development.
To apply existing migrations in deployments, use prisma migrate deploy.
```

**원인**: Phase 4(컬럼 추가)에서는 잘 됐는데, 이번엔 **unique 제약**이 들어가서 Prisma가 "기존 데이터가 중복이면
실패합니다, 계속할까요?" 확인을 받으려 했다. 터미널이 비대화형이라 확인 프롬프트를 띄울 수 없어 거부한 것.

**해결**: 읽기 전용인 `migrate diff`로 "현재 DB → 스키마" 차이 SQL만 뽑아, 기존과 같은 이름 규칙의 폴더에
직접 저장한 뒤 `migrate deploy`로 적용했다. (중복 데이터는 2절의 SQL로 미리 확인)

```bash
DIR="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_add_like_guest_unique_view_index"
mkdir -p "$DIR"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "$DIR/migration.sql"
npx prisma migrate deploy
npx prisma generate
npx prisma migrate status   # Database schema is up to date!
```

### 5-2. 대시보드 "총 조회수 1"인데 "오늘 조회수 2"

첫 테스트에서 숫자가 서로 안 맞았다.

```
PASS  dashboard: 200 with numeric totals  — {"users":16,"posts":2,"views":1,"comments":4}
PASS  dashboard: viewTrend = …  — [{"date":"2026-10-30","views":0},{"date":"2026-10-31","views":2}]
```

**원인**: 총계는 "삭제되지 않은 글"의 `viewCount` 합인데, 추이는 `post_views`를 그대로 세서 **이전 테스트에서
만들고 소프트 삭제한 글의 조회 기록**까지 포함됐다. 테스트는 통과했지만 숫자를 직접 읽어보고서야 알았다.

**해결**: 추이 쿼리에 `posts`를 JOIN해 `p."deletedAt" IS NULL` 조건을 추가하고, "14일 추이 합 ≤ 총 조회수" 검증을
테스트에 추가했다.

### 5-3. 최근 댓글에 삭제된 글의 댓글이 보임

스크린샷의 "최근 댓글" 위젯에 이미 삭제된 테스트 글의 댓글이 떠 있었다 (링크를 누르면 404).
같은 원인으로 총 댓글 수와 **Phase 4의 관리자 댓글 목록**도 삭제된 글의 댓글을 포함하고 있었다.

**해결**: "댓글도 삭제되지 않았고, 글도 삭제되지 않은 것"을 상수로 두고 세 곳 모두 적용했다.

```ts
const VISIBLE_COMMENT = { deletedAt: null, post: { deletedAt: null } } satisfies Prisma.CommentWhereInput;
```

삭제된 글의 댓글은 공개 화면 어디에도 안 보이므로 모더레이션 대상에서도 빼는 게 맞다. 글 삭제 후 위젯/목록에서
사라지는지 검증하는 테스트 2건을 추가했다.

### 5-4. 검색어 없이 요청하면 영어 에러 메시지

```
search: missing q → 400  — Invalid input: expected string, received undefined
```

`.min(1, "검색어를 입력해주세요.")`는 **빈 문자열**에만 적용되고, `q` 자체가 없으면(undefined) Zod 기본 메시지가
나간다. Zod 4의 `z.string({ error: "검색어를 입력해주세요." })`로 "타입 자체가 틀린 경우" 메시지도 지정했다.

### 5-5. 브라우저 콘솔의 Base UI `nativeButton` 경고 (기존 버그)

스크린샷에 Next.js 개발 오버레이가 **"2 Issues"**를 표시하고 있었다. 서버 로그는 깨끗해서 puppeteer로 브라우저
콘솔을 수집해보니 모든 페이지에서 같은 에러가 나오고 있었다.

```
Base UI: A component that acts as a button expected a native <button> because the `nativeButton` prop is true.
Rendering a non-<button> removes native button semantics, which can impact forms and accessibility.
Use a real <button> in the `render` prop, or set `nativeButton` to `false`.
    at Button … at Header …
```

**원인**: shadcn(Base UI) `Button`에 `render={<Link />}`를 주면 실제로는 `<a>`가 렌더링되는데, Base UI는 기본적으로
`<button>`이라고 가정한다. 헤더의 "글쓰기"/"로그인"/"회원가입"은 Phase 2-3부터 이 상태였고, 이번에 추가한 검색
아이콘이 하나를 더했다.

**해결**: `Button`을 링크로 렌더링하는 7곳(헤더 4, `PostOwnerActions` 1, `MyPostList` 2)에 `nativeButton={false}`를
추가했다. 수정 후 콘솔 에러 0건.

> 교훈: 지금까지는 HTTP 상태 코드와 HTML만 확인했는데, **실제 브라우저를 띄워야만 보이는 문제**가 있었다.

### 5-6. Recharts 3 툴팁 타입 에러

```
error TS2322: Type '({ active, payload, label }: TooltipContentProps<number, string>) => Element | null'
is not assignable to type 'ContentType<ValueType, NameType> | undefined'.
```

`<Tooltip content>`는 기본 제네릭(`ValueType`, `NameType`)의 props를 넘겨준다. 좁힌 `<number, string>`을 받는 함수는
할당할 수 없어서, 제네릭 없이 받고 값은 `Number(payload[0].value ?? 0)`로 변환했다.

### 5-7. 테스트를 여러 번 돌리면 회원가입 429

회원가입 Rate Limit(1시간 5회)은 메모리에 저장된다. 테스트 스크립트가 매번 새 계정을 만들어 같은 서버로 여러 번
돌리면 막힌다. nodemon이 파일 변경 시 서버를 재시작하는 점을 이용해, 테스트 사이에 `touch src/app.ts`로 카운터를
초기화했다 (운영 코드는 그대로).

---

## 6. 남은 검증/개선 항목

- [ ] 브라우저에서 실제 클릭: 좋아요 토글(낙관적 업데이트), 회원 정지 confirm, 검색 페이지 이동 (화면 렌더링은 확인, 클릭 동작은 미확인)
- [ ] (Phase 8) 프론트/백엔드 도메인이 다르면 `guestId` 쿠키를 `SameSite=None; Secure`로 변경
- [ ] 🔐 (기존 코드) `lib/ip.ts`의 `getClientIp`가 `X-Forwarded-For` 헤더를 그대로 믿는다 → 헤더를 바꿔가며 요청하면
      **조회수(`PostView` 중복 방지)를 부풀릴 수 있다.** (Rate Limit은 `express-rate-limit`이 `req.ip`를 쓰고
      `trust proxy`가 꺼져 있어 이 헤더의 영향을 받지 않는다.) 배포 환경의 프록시 구성이 정해지는 Phase 8에서
      Express `trust proxy` + `req.ip`로 통일 필요
- [ ] 게스트 좋아요는 쿠키 삭제로 반복 가능 (구조적 한계, Rate Limit으로 완화만)
- [ ] 검색이 HTML 태그/속성 이름에도 걸림 — 글이 많아지면 평문 컬럼 또는 `tsvector` 전문 검색 고려
- [ ] 테스트 실행으로 DB에 `@test.local` 테스트 계정이 다수 누적됨 (글은 소프트 삭제됨) — 정리 여부 결정 필요

---

## 7. 배운 점

1. **"테스트 통과"와 "숫자가 맞다"는 다르다.** 추이 합과 총계가 어긋난 걸 테스트는 잡지 못했고, 출력된 숫자를
   읽고서야 알았다. 그 뒤 두 숫자의 관계 자체를 테스트로 만들었다.
2. **같은 개념은 한 곳에서 정의한다.** "보이는 댓글"의 조건이 세 군데 흩어져 있으니 한 곳만 고쳐지는 일이
   생긴다 — 상수(`VISIBLE_COMMENT`)로 모았다.
3. **권한은 토큰이 아니라 현재 상태로.** 정지 기능을 만들고 "정말 막히나?"를 경로별로 표로 점검하니 쓰기 라우트의
   15분 구멍이 보였다.
4. **차트는 규칙대로 만들고, 눈으로 본다.** 색 검증은 스크립트로 통과했지만 곡선 보간의 문제는 렌더링을 보고서야
   알 수 있었다.
5. **브라우저를 띄워봐야 보이는 문제가 있다.** HTTP 200 + HTML 검사로는 콘솔 경고를 몇 Phase 동안 놓치고 있었다.
