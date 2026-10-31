import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { toQueryString } from "@/lib/queryString";
import type { AdminUser, AdminUserListData, DashboardStats, UserStatus } from "@/types/admin";

/** 관리자 세션이 준비됐을 때만 조회한다 (토큰 없이 호출해 401이 나는 것 방지) */
function useAdminSession() {
  const { data: session, status } = useSession();
  return {
    accessToken: session?.accessToken,
    enabled:
      status === "authenticated" && session?.user.role === "ADMIN" && Boolean(session?.accessToken),
  };
}

/** GET /api/admin/dashboard — 🛡️ */
export function useAdminDashboard() {
  const { accessToken, enabled } = useAdminSession();
  return useQuery({
    queryKey: ["adminDashboard"],
    queryFn: () => apiFetch<DashboardStats>("/api/admin/dashboard", { accessToken }),
    enabled,
  });
}

/** GET /api/admin/users — 🛡️ (q = 닉네임/이메일) */
export function useAdminUsers(
  params: { page?: number; limit?: number; q?: string; status?: UserStatus } = {},
) {
  const { accessToken, enabled } = useAdminSession();
  return useQuery({
    queryKey: ["adminUsers", params],
    queryFn: () =>
      apiFetch<AdminUserListData>(`/api/admin/users${toQueryString(params)}`, { accessToken }),
    enabled,
  });
}

/** PATCH /api/admin/users/:id/status — 🛡️ 정지/해제 */
export function useChangeUserStatus() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      apiFetch<AdminUser>(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        accessToken: session?.accessToken,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminUsers"] }),
        queryClient.invalidateQueries({ queryKey: ["adminDashboard"] }),
      ]),
  });
}
