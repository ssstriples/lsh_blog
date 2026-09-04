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

export interface ListPostsParams {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  q?: string;
  sort?: "latest" | "popular";
  authorId?: string;
}
