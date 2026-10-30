export type PostStatus = "DRAFT" | "PUBLISHED";

export interface PostAuthorSummary {
  id: string;
  name: string;
}

export interface PostCategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface PostTagSummary {
  id: string;
  name: string;
  slug: string;
}

/** 목록/카드에 쓰이는 게시글 요약 (본문 제외) */
export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  status: PostStatus;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  author: PostAuthorSummary;
  category: PostCategorySummary | null;
  tags: { tag: PostTagSummary }[];
}

/** 상세 조회 시 본문(content)까지 포함 */
export interface PostDetail extends PostSummary {
  content: string;
}

export interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface PostListData {
  posts: PostSummary[];
  pagination: Pagination;
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

/** POST /api/posts, PATCH /api/posts/:id 요청 바디 — authorId는 서버가 채우므로 절대 넣지 않는다. */
export interface PostInput {
  title: string;
  content: string;
  slug?: string;
  categoryId: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  status: PostStatus;
}

/** 마이페이지/관리자 목록 쿼리 (DRAFT 포함이라 상태 필터가 있다) */
export interface ManagePostsParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: PostStatus;
}

/** GET /api/admin/posts 목록 항목 — 모더레이션용이라 작성자 이메일까지 포함 */
export interface AdminPostSummary {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  viewCount: number;
  createdAt: string;
  author: PostAuthorSummary & { email: string };
}

export interface AdminPostListData {
  posts: AdminPostSummary[];
  pagination: Pagination;
}

export interface ListPostsParams {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  q?: string;
  sort?: "latest" | "popular";
  authorId?: string;
}
