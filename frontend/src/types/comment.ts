import type { Pagination } from "@/types/post";

export type CommentAuthor =
  { type: "user"; id: string; name: string } | { type: "guest"; name: string };

/** GET /api/posts/:postId/comments 트리 노드 — 삭제됐지만 답글이 남은 댓글은 isDeleted=true로 자리만 유지 */
export interface CommentNode {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: CommentAuthor | null;
  replies: CommentNode[];
}

export interface CommentListData {
  comments: CommentNode[];
  /** 삭제되지 않은 댓글 수 (답글 포함) */
  totalCount: number;
}

/** POST /api/posts/:postId/comments 요청 바디 — 로그인 상태면 guestName/guestPassword는 서버가 무시한다 */
export interface CreateCommentInput {
  content: string;
  parentId?: string;
  guestName?: string;
  guestPassword?: string;
}

/** GET /api/admin/comments 목록 항목 */
export interface AdminComment {
  id: string;
  content: string;
  guestName: string | null;
  createdAt: string;
  parentId: string | null;
  user: { id: string; name: string; email: string } | null;
  post: { id: string; title: string; slug: string };
}

export interface AdminCommentListData {
  comments: AdminComment[];
  pagination: Pagination;
}
