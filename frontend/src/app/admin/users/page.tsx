import { AdminUserList } from "@/components/admin/AdminUserList";
import type { UserStatus } from "@/types/admin";

function parseUserStatus(value: string | string[] | undefined): UserStatus | undefined {
  return value === "ACTIVE" || value === "SUSPENDED" ? value : undefined;
}

// 🛡️ 관리자 전용 — proxy.ts가 비관리자 접근을 /403으로 리다이렉트한다 (최종 권한 검증은 백엔드 requireAdmin).
export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const { page: pageParam, q, status } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <AdminUserList
        page={page}
        q={typeof q === "string" ? q : undefined}
        status={parseUserStatus(status)}
      />
    </main>
  );
}
