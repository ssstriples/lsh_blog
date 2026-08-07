# 🗄️ DB 스키마 (ERD) — lsh_blog

> PostgreSQL + Prisma ORM. onggi-shop 스키마 패턴(cuid, soft delete, self-ref) 재사용.
> ⚠️ **2차 개정 (2026-08-07)**: 관리자 단일 작성자 → **모든 회원(User)이 Post의 author가 될 수 있는 멀티 유저 구조**로 변경.
> `User.status`(정지 여부) 필드 추가.

## ERD 관계 다이어그램

```
┌─────────┐        ┌──────────┐
│  User   │──1:N───│   Post   │──1:N──┐
│(USER/   │ author │          │       │
│ ADMIN)  │        │          │──N:M──┤ Tag (PostTag)
└─────────┘        │          │       │
                    └────┬─────┘       │
                       1:N│            │
                    ┌─────▼─────┐      │
                    │  Comment  │      │
                    │(self-ref  │      │
                    │ parentId) │      │
                    └───────────┘      │
                                       │
Category ──1:N── Post                 │
Post ──1:N── PostView (조회 로그)      │
Post ──1:N── PostLike                 │
```

> 💡 **핵심 변경점**: `Post.authorId`는 기존에도 존재했지만, 기존 설계에서는 "관리자 1명만" author가 될 수 있었습니다.
> 이번 개정에서는 **`role: USER`인 일반 회원도 자유롭게 author가 되어 자신의 글을 CRUD**할 수 있도록 하고,
> API 레이어에서 "요청자 == authorId (또는 ADMIN)" 검증을 추가합니다. (스키마 구조 자체는 이미 이를 지원하고 있었음)

## 전체 `schema.prisma` (초안)

```prisma
// backend/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

enum UserStatus {
  ACTIVE
  SUSPENDED   // 관리자에 의해 정지된 계정 — 로그인/글쓰기/댓글 작성 차단
}

enum PostStatus {
  DRAFT
  PUBLISHED
}

model User {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String?
  name      String
  role      Role       @default(USER)
  status    UserStatus @default(ACTIVE)
  provider  String?
  providerId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  posts    Post[]      // 이 유저가 작성한 모든 게시글 (본인만 수정/삭제 가능)
  comments Comment[]
  likes    PostLike[]

  @@index([email])
  @@map("users")
}

model Category {
  id        String  @id @default(cuid())
  name      String
  slug      String  @unique
  sortOrder Int     @default(0)

  posts Post[]

  @@map("categories")
}

model Tag {
  id   String @id @default(cuid())
  name String @unique
  slug String @unique

  posts PostTag[]

  @@map("tags")
}

model Post {
  id           String     @id @default(cuid())
  title        String
  slug         String     @unique
  content      String     @db.Text   // TipTap HTML (DOMPurify sanitized)
  thumbnailUrl String?
  status       PostStatus @default(DRAFT)
  viewCount    Int        @default(0)
  authorId     String     // 작성자 = 소유자. 이 필드로 Ownership Authorization 수행
  categoryId   String?

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  publishedAt DateTime?
  deletedAt DateTime?

  author   User        @relation(fields: [authorId], references: [id])
  category Category?   @relation(fields: [categoryId], references: [id])
  tags     PostTag[]
  comments Comment[]
  views    PostView[]
  likes    PostLike[]

  @@index([slug])
  @@index([status, publishedAt])
  @@index([authorId])   // "내가 쓴 글" 목록 조회(마이페이지) 최적화
  @@map("posts")
}

model PostTag {
  postId String
  tagId  String

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tags")
}

model Comment {
  id       String  @id @default(cuid())
  postId   String
  userId   String?  // 댓글 작성자 = 소유자. 이 필드로 Ownership Authorization 수행
  guestName String?  // 비로그인 댓글 허용 시
  content  String   @db.Text
  parentId String?  // 대댓글

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  post    Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  user    User?     @relation(fields: [userId], references: [id])
  parent  Comment?  @relation("CommentTree", fields: [parentId], references: [id])
  replies Comment[] @relation("CommentTree")

  @@index([postId])
  @@map("comments")
}

model PostView {
  id        String   @id @default(cuid())
  postId    String
  ipHash    String   // IP 해시 (개인정보 보호)
  viewedAt  DateTime @default(now())

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@unique([postId, ipHash])   // 동일 IP 중복 카운트 방지 (일단위 재설계 가능)
  @@map("post_views")
}

model PostLike {
  id     String @id @default(cuid())
  postId String
  userId String?
  guestId String?  // 비로그인 좋아요용 쿠키 ID

  createdAt DateTime @default(now())

  post Post  @relation(fields: [postId], references: [id], onDelete: Cascade)
  user User? @relation(fields: [userId], references: [id])

  @@unique([postId, userId])
  @@map("post_likes")
}
```

## 설계 메모

| 항목 | 결정 |
|------|------|
| 카테고리 트리 구조 | onggi-shop은 self-ref 트리였으나 블로그는 flat 구조로 단순화 (필요 시 확장) |
| **작성자(author) 권한** | **모든 `role: USER` 회원이 `Post.authorId`가 될 수 있음.** API 레벨에서 `PATCH/DELETE`시 `authorId === req.user.id` 검증 (ADMIN은 예외) |
| **회원 정지 처리** | `User.status: SUSPENDED`인 경우 로그인/글쓰기/댓글 작성 API에서 403 응답 |
| 댓글 비로그인 허용 | `userId` nullable + `guestName` 필드로 게스트 댓글 지원. 로그인 댓글은 `userId`가 소유권 기준 |
| 조회수 중복 방지 | `PostView`에 `ipHash` unique 제약 (IP 원문 대신 해시 저장 — 개인정보 보호) |
| 좋아요 비로그인 허용 | `guestId`(쿠키 기반 UUID)로 익명 좋아요 지원 |
| Soft Delete | `User`, `Post`, `Comment`에 `deletedAt` 적용 (onggi-shop 패턴 동일). 유저 탈퇴 시에도 작성 글은 유지, 화면상 "탈퇴한 회원"으로 표시 |
| `Post.authorId` 인덱스 | 마이페이지(`/my/posts`)에서 "내가 쓴 글" 목록을 빠르게 조회하기 위해 인덱스 추가 |

