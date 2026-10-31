import { DashboardView } from "@/components/admin/DashboardView";

// 🛡️ 관리자 전용 — proxy.ts가 비관리자 접근을 /403으로 리다이렉트한다 (최종 권한 검증은 백엔드 requireAdmin).
export default function AdminDashboardPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <DashboardView />
    </main>
  );
}
