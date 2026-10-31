import type { Pagination } from "@/types/post";
import type { UserRole } from "@/types/auth";

export type UserStatus = "ACTIVE" | "SUSPENDED";

/** GET /api/admin/dashboard */
export interface DashboardStats {
  totals: { users: number; posts: number; views: number; comments: number };
  popularPosts: {
    id: string;
    title: string;
    slug: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
    author: { id: string; name: string };
  }[];
  recentComments: {
    id: string;
    content: string;
    createdAt: string;
    guestName: string | null;
    user: { id: string; name: string } | null;
    post: { title: string; slug: string };
  }[];
  /** 최근 14일(KST) 일별 조회수 — 조회가 없던 날도 0으로 채워져 있다 */
  viewTrend: { date: string; views: number }[];
}

/** GET /api/admin/users 목록 항목 */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  postCount: number;
  commentCount: number;
}

export interface AdminUserListData {
  users: AdminUser[];
  pagination: Pagination;
}
