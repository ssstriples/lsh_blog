---
title: "기술 블로그를 직접 만들어보자 #5 — 내 글은 나만 수정할 수 있게, 소유권 검증 만들기"
slug: "build-my-blog-05-post-crud-ownership-authorization"
date: "2026-08-10"
category: "프로젝트 회고"
tags: ["보안", "백엔드", "Express", "권한", "XSS"]
status: "DRAFT"
summary: "회원가입/로그인을 만들었으니, 이제 로그인한 사람이 자기 글을 쓰고 고치고 지울 수 있게 해야죠. '내 글만 수정 가능'을 안전하게 구현하는 방법과, 저장형 XSS를 막는 방법을 다룹니다."
---

# 기술 블로그를 직접 만들어보자 #5 — 내 글은 나만 수정할 수 있게, 소유권 검증 만들기

> [4편](./2026-08-07-build-my-blog-04-jwt-auth-signup-login.md)에서 회원가입/로그인을 만들었다면,
> 이번 5편에서는 로그인한 사용자가 **자신의 게시글을 쓰고, 수정하고, 삭제**할 수
> 있는 기능을 만들어보겠습니다. 핵심은 "다른 사람 글은 절대 손댈 수 없게"
> 만드는 것입니다.

## 이 글에서 다루는 내용

1. "소유권 검증"이 왜 필요한가요?
2. 재사용 가능한 소유권 체크 로직 설계하기
3. 클라이언트가 절대 조작할 수 없어야 하는 값들
4. 저장형 XSS 공격이란? — 게시글 저장 시 안전하게 만들기
5. 실제로 테스트해보기 (두 명의 유저로 검증)

---

## 1. "소유권 검증"이 왜 필요한가요?

로그인 기능만 있으면 "로그인했는지 아닌지"는 알 수 있지만, "이 글이 정말
당신 글이 맞는지"는 별개의 문제입니다. 예를 들어 로그인 검증만 있고
소유권 검증이 없다면, Bob이 로그인한 상태에서 Alice가 쓴 글의 ID를 알아내
"이 글 수정해줘" 요청을 보내면 **그대로 수정되어 버립니다.**

그래서 게시글을 수정/삭제하는 API에는 다음 두 단계 검증이 모두 필요합니다.

1. **인증(Authentication)**: 로그인은 했는가? (JWT 토큰 검증)
2. **인가(Authorization) — 소유권 검증**: 로그인한 사람이 이 리소스(글)의
   실제 작성자가 맞는가?

---

## 2. 재사용 가능한 소유권 체크 만들기

게시글뿐 아니라 나중에 댓글 삭제에도 똑같은 규칙("본인 것만, 관리자는 예외")이
필요할 것 같아서, **리소스 종류와 무관하게 재사용 가능한 함수**로 만들었습니다.

```ts
function requireOwnership(getOwnerId) {
  return async (req, res, next) => {
    const ownerId = await getOwnerId(req);       // 이 리소스의 진짜 주인이 누구인지 조회
    const isOwner = ownerId === req.user.id;      // 로그인한 사람과 같은가?
    const isAdmin = req.user.role === "ADMIN";    // 관리자는 예외로 통과

    if (!isOwner && !isAdmin) {
      return next(new AppError("본인이 작성한 콘텐츠만 수정/삭제할 수 있습니다.", 403));
    }
    next();
  };
}
```

게시글 라우트에서는 "게시글의 주인이 누구인지 조회하는 함수"만 넘겨주면 됩니다.

```ts
const ownershipCheck = requireOwnership((req) => getPostAuthorId(req.params.id));

router.patch("/:id", requireAuth, ownershipCheck, updatePostHandler);
router.delete("/:id", requireAuth, ownershipCheck, deletePostHandler);
```

나중에 댓글에도 적용하고 싶다면 `requireOwnership((req) => getCommentUserId(req.params.id))`
처럼 "무엇의 주인을 조회할지"만 바꿔주면 끝입니다.

---

## 3. 클라이언트가 절대 조작할 수 없어야 하는 값

게시글을 생성하는 API를 만들 때, 가장 조심해야 할 부분은 **"이 글의 작성자가
누구인지"를 절대 클라이언트(요청 바디)가 결정하지 못하게 하는 것**입니다.

```ts
// ❌ 위험한 방식 — 클라이언트가 authorId를 보낼 수 있다면?
app.post("/api/posts", (req, res) => {
  db.post.create({ authorId: req.body.authorId, ... }); // 다른 사람 명의로 글 작성 가능!
});

// ✅ 안전한 방식 — authorId는 검증된 로그인 토큰에서만 가져온다
app.post("/api/posts", requireAuth, (req, res) => {
  db.post.create({ authorId: req.user.id, ...req.body }); // req.body에는 authorId가 아예 없음
});
```

이 프로젝트에서는 아예 입력 검증 스키마(Zod)에 `authorId` 필드 자체를 넣지
않아서, 실수로라도 클라이언트 값을 반영할 여지를 원천 차단했습니다.

---

## 4. 저장형 XSS와 sanitize

블로그 에디터(TipTap)는 사용자가 입력한 내용을 HTML로 만들어서 저장합니다.
그런데 만약 누군가 API를 직접 호출해서 `<script>alert('해킹')</script>` 같은
악성 코드를 게시글 본문에 넣으면 어떻게 될까요? 그 글을 읽는 모든 사람의
브라우저에서 이 스크립트가 실행됩니다 (이런 공격을 **저장형(Stored) XSS**라고
부릅니다 — 한 번 저장되면 그 글을 보는 모두가 피해를 입기 때문에 특히 위험합니다).

이를 막기 위해 게시글을 저장하기 직전에 **DOMPurify**로 위험한 태그/속성을
제거합니다.

```ts
import DOMPurify from "isomorphic-dompurify";

function sanitizeContent(html) {
  return DOMPurify.sanitize(html); // <script>, onerror= 같은 위험 요소 제거
}
```

실제로 테스트해보면:

```
저장 요청: "<p>안녕 <script>alert(1)</script></p>"
저장된 결과: "<p>안녕 </p>"    ← <script> 태그가 사라짐
```

---

## 5. 실제로 테스트해보기

Alice와 Bob, 두 명의 유저 계정을 만들어서 실제로 검증해봤습니다.

| 시나리오 | 예상 결과 | 실제 결과 |
|---|---|---|
| Alice가 글 작성 | 201 성공 | ✅ 201 |
| Bob이 Alice 글 수정 시도 | 403 Forbidden | ✅ 403 |
| Bob이 Alice 글 삭제 시도 | 403 Forbidden | ✅ 403 |
| Alice가 자기 글 수정 | 200 성공 | ✅ 200 |
| 로그인 없이 글 작성 시도 | 401 Unauthorized | ✅ 401 |
| Alice가 마이페이지 조회 | 자기 글 목록 반환 | ✅ 정상 |

모든 시나리오가 의도한 대로 동작하는 것을 확인했습니다. 🎉

---

## 마무리

이번 편에서는 "로그인은 했지만 남의 글은 못 건드리게" 만드는 소유권 검증과,
게시글 저장 시 XSS를 방지하는 방법을 다뤄봤습니다. 다음 편에서는 게시글에
**댓글을 달고, 본인 댓글만 삭제할 수 있는 기능**을 같은 소유권 검증 패턴을
재사용해서 구현해보겠습니다.
