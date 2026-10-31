"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Ban, CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/common/Pagination";
import { PostFilterBar, type StatusOption } from "@/components/common/PostFilterBar";
import { useAdminUsers, useChangeUserStatus } from "@/hooks/useAdmin";
import { formatDate } from "@/lib/formatDate";
import type { AdminUser, UserStatus } from "@/types/admin";

const PAGE_SIZE = 20;

const USER_STATUS_OPTIONS: StatusOption[] = [
  { value: undefined, label: "전체" },
  { value: "ACTIVE", label: "활성" },
  { value: "SUSPENDED", label: "정지" },
];

/** 상태는 색만으로 구분하지 않는다 — 아이콘 + 글자를 함께 쓴다 */
function UserStatusBadge({ status }: { status: UserStatus }) {
  return status === "SUSPENDED" ? (
    <Badge variant="destructive">
      <Ban aria-hidden />
      정지
    </Badge>
  ) : (
    <Badge variant="outline">
      <CircleCheck aria-hidden />
      활성
    </Badge>
  );
}

function AdminUserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const statusMutation = useChangeUserStatus();
  const isSuspended = user.status === "SUSPENDED";
  const nextStatus: UserStatus = isSuspended ? "ACTIVE" : "SUSPENDED";
  // 백엔드도 막지만, 누를 수 없는 버튼은 처음부터 비활성화해 이유를 보여준다
  const lockedReason = isSelf ? "본인 계정" : user.role === "ADMIN" ? "관리자 계정" : null;

  return (
    <tr className="border-b last:border-0">
      <td className="max-w-0 py-3 pr-3">
        <span className="flex items-center gap-1.5">
          <Link href={`/users/${user.id}`} className="line-clamp-1 font-medium hover:underline">
            {user.name}
          </Link>
          {user.role === "ADMIN" && <Badge>관리자</Badge>}
        </span>
        <span className="text-muted-foreground line-clamp-1 text-xs">{user.email}</span>
      </td>
      <td className="text-muted-foreground hidden py-3 pr-3 sm:table-cell">
        {formatDate(user.createdAt)}
      </td>
      <td className="text-muted-foreground hidden py-3 pr-3 text-right tabular-nums md:table-cell">
        {user.postCount} / {user.commentCount}
      </td>
      <td className="py-3 pr-3">
        <UserStatusBadge status={user.status} />
      </td>
      <td className="py-3 text-right">
        {lockedReason ? (
          <span className="text-muted-foreground text-xs">{lockedReason}</span>
        ) : (
          <Button
            variant={isSuspended ? "outline" : "destructive"}
            size="sm"
            disabled={statusMutation.isPending}
            onClick={() => {
              const message = isSuspended
                ? `${user.name}님의 정지를 해제하시겠습니까?`
                : `${user.name}님을 정지하시겠습니까?\n정지되면 로그인과 글·댓글 작성이 차단됩니다.`;
              if (!window.confirm(message)) return;
              statusMutation.mutate(
                { id: user.id, status: nextStatus },
                {
                  onSuccess: () =>
                    toast.success(
                      isSuspended ? "정지가 해제되었습니다." : "회원이 정지되었습니다.",
                    ),
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            {isSuspended ? "정지 해제" : "정지"}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function AdminUserList({
  page,
  q,
  status,
}: {
  page: number;
  q?: string;
  status?: UserStatus;
}) {
  const { data: session } = useSession();
  const { data, isPending, isError } = useAdminUsers({ page, limit: PAGE_SIZE, q, status });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        전체 회원{" "}
        {data && <span className="text-muted-foreground">({data.pagination.totalCount})</span>}
      </h1>

      <PostFilterBar
        basePath="/admin/users"
        q={q}
        status={status}
        placeholder="닉네임 또는 이메일 검색"
        statusOptions={USER_STATUS_OPTIONS}
      />

      {isPending ? (
        <p className="text-muted-foreground py-16 text-center text-sm">불러오는 중...</p>
      ) : isError ? (
        <p className="text-destructive py-16 text-center text-sm">
          회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : data.users.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">회원이 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] table-fixed text-sm">
              <thead className="text-muted-foreground border-b text-left">
                <tr>
                  <th className="py-2 pr-3 font-medium">회원</th>
                  <th className="hidden w-36 py-2 pr-3 font-medium sm:table-cell">가입일</th>
                  <th className="hidden w-24 py-2 pr-3 text-right font-medium md:table-cell">
                    글 / 댓글
                  </th>
                  <th className="w-20 py-2 pr-3 font-medium">상태</th>
                  <th className="w-24 py-2 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <AdminUserRow key={user.id} user={user} isSelf={user.id === session?.user.id} />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            basePath="/admin/users"
            query={{ q, status }}
          />
        </>
      )}
    </div>
  );
}
