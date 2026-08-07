# 🗄️ DB 스키마 (ERD) — lsh_blog

> PostgreSQL + Prisma ORM. onggi-shop 스키마 패턴(cuid, soft delete, self-ref) 재사용.

## ERD 관계 다이어그램

```
┌─────────┐        ┌──────────┐
│  User   │──1:N───│   Post   │──1:N──┐
│(ADMIN)  │        │          │       │
└─────────┘        │          │──N:M──┤ Tag (PostTag)
                    │          │       │
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

enum PostStatus {
  DRAFT
  PUBLISHED
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String?
  name      String
  role      Role     @default(USER)
  provider  String?
  providerId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  posts    Post[]
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
  authorId     String
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
  userId   String?
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
| 댓글 비로그인 허용 | `userId` nullable + `guestName` 필드로 게스트 댓글 지원 |
| 조회수 중복 방지 | `PostView`에 `ipHash` unique 제약 (IP 원문 대신 해시 저장 — 개인정보 보호) |
| 좋아요 비로그인 허용 | `guestId`(쿠키 기반 UUID)로 익명 좋아요 지원 |
| Soft Delete | `Post`, `Comment`에 `deletedAt` 적용 (onggi-shop 패턴 동일) |
