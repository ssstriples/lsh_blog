# 🔌 API 엔드포인트 목록 — lsh_blog

> Base URL: `http://localhost:4100` (개발, onggi-shop 4000과 포트 분리)

## 인증 방식

```
Authorization: Bearer <accessToken>
Cookie: refreshToken=<token>  (HttpOnly; Secure; SameSite=Strict; path=/api/auth/refresh)
```

| 아이콘 | 의미 |
|---|---|
| 🔓 | 인증 불필요 |
| 🔒 | 로그인 필요 |
| 🛡️ | 관리자 전용 |

## 1. 인증 (`/api/auth`)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/auth/login` | 🔓 | 관리자 로그인 |
| POST | `/api/auth/refresh` | 🔓 | Access Token 재발급 |
| POST | `/api/auth/logout` | 🔒 | 로그아웃 |

## 2. 게시글 (`/api/posts`)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/posts` | 🔓 | 목록 (page, limit, category, tag, q, sort) |
| GET | `/api/posts/:slug` | 🔓 | 상세 (조회수 증가) |
| POST | `/api/admin/posts` | 🛡️ | 생성 |
| PATCH | `/api/admin/posts/:id` | 🛡️ | 수정 |
| DELETE | `/api/admin/posts/:id` | 🛡️ | 소프트 삭제 |
| PATCH | `/api/admin/posts/:id/status` | 🛡️ | DRAFT/PUBLISHED 전환 |
| POST | `/api/admin/posts/upload-image` | 🛡️ | 에디터 이미지 업로드 (Cloudinary) |

### GET `/api/posts` 예시
```json
// Query: ?page=1&limit=10&category=dev&tag=nextjs&q=검색어&sort=latest
// Response 200
{
  "success": true,
  "data": {
    "posts": [
      { "id": "...", "title": "...", "slug": "...", "thumbnailUrl": "...", "viewCount": 120, "publishedAt": "..." }
    ],
    "pagination": { "page": 1, "totalPages": 5, "totalCount": 48 }
  }
}
```

## 3. 카테고리 / 태그

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/categories` | 🔓 | 카테고리 목록 |
| GET | `/api/tags` | 🔓 | 태그 목록 |
| POST | `/api/admin/categories` | 🛡️ | 카테고리 생성 |
| PATCH | `/api/admin/categories/:id` | 🛡️ | 수정 |
| DELETE | `/api/admin/categories/:id` | 🛡️ | 삭제 |

## 4. 댓글 (`/api/posts/:postId/comments`)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/posts/:postId/comments` | 🔓 | 댓글 목록 (대댓글 포함 트리) |
| POST | `/api/posts/:postId/comments` | 🔓(게스트 허용) | 댓글 작성 |
| DELETE | `/api/comments/:id` | 🔒/🛡️ | 삭제 (본인 또는 관리자) |

## 5. 좋아요

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/posts/:postId/like` | 🔓(쿠키 기반) | 좋아요 토글 |

## 6. 검색

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/search?q=` | 🔓 | 제목+본문 검색 |

## 7. 관리자 대시보드 (`/api/admin`)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/admin/dashboard` | 🛡️ | 총 게시글/조회수, 인기글 Top5, 최근 댓글 |
| GET | `/api/admin/comments` | 🛡️ | 전체 댓글 관리 (스팸 삭제) |

## 8. RSS / Sitemap (Should Have)

| Method | Endpoint | 인증 | 설명 |
|---|---|---|---|
| GET | `/rss.xml` | 🔓 | RSS 피드 |
| GET | `/sitemap.xml` | 🔓 | 사이트맵 (next-sitemap) |
