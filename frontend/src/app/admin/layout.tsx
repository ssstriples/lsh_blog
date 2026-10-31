import { AdminNav } from "@/components/admin/AdminNav";

/** /admin/* 공통 레이아웃 — 대시보드/게시글/댓글/회원 탭 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
