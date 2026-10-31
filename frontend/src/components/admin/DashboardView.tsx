"use client";

import Link from "next/link";
import { Eye, FileText, MessageSquare, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewTrendChart } from "@/components/admin/ViewTrendChart";
import { useAdminDashboard } from "@/hooks/useAdmin";
import { formatDateTime } from "@/lib/formatDate";

/** 1만 이상은 "1.3만"처럼 줄이고, 그 아래는 1,284처럼 그대로 보여준다 */
function formatStat(value: number): string {
  if (value < 10_000) return value.toLocaleString("ko-KR");
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </span>
        <span className="text-2xl font-semibold">{formatStat(value)}</span>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { data, isPending, isError } = useAdminDashboard();

  if (isPending) {
    return <p className="text-muted-foreground py-16 text-center text-sm">불러오는 중...</p>;
  }
  if (isError) {
    return (
      <p className="text-destructive py-16 text-center text-sm">
        통계를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </p>
    );
  }

  const { totals, popularPosts, recentComments, viewTrend } = data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>

      <section aria-label="운영 현황" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="총 회원" value={totals.users} icon={Users} />
        <StatTile label="총 게시글" value={totals.posts} icon={FileText} />
        <StatTile label="총 조회수" value={totals.views} icon={Eye} />
        <StatTile label="총 댓글" value={totals.comments} icon={MessageSquare} />
      </section>

      <Card>
        <CardContent>
          <ViewTrendChart data={viewTrend} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>인기글 Top 5</CardTitle>
          </CardHeader>
          <CardContent>
            {popularPosts.length === 0 ? (
              <p className="text-muted-foreground text-sm">아직 발행된 글이 없습니다.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {popularPosts.map((post, i) => (
                  <li key={post.id} className="flex items-start gap-3 text-sm">
                    <span className="text-muted-foreground w-4 shrink-0 font-semibold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/posts/${post.slug}`}
                        className="line-clamp-1 font-medium hover:underline"
                      >
                        {post.title}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {post.author.name} · 조회 {post.viewCount.toLocaleString("ko-KR")} · 좋아요{" "}
                        {post.likeCount} · 댓글 {post.commentCount}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>최근 댓글</CardTitle>
            <Link href="/admin/comments" className="text-muted-foreground text-xs hover:underline">
              전체 보기
            </Link>
          </CardHeader>
          <CardContent>
            {recentComments.length === 0 ? (
              <p className="text-muted-foreground text-sm">아직 댓글이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recentComments.map((comment) => (
                  <li key={comment.id} className="text-sm">
                    <p className="line-clamp-2 break-words">{comment.content}</p>
                    <p className="text-muted-foreground text-xs">
                      {comment.user?.name ?? `${comment.guestName ?? "익명"} (비회원)`} ·{" "}
                      <Link href={`/posts/${comment.post.slug}`} className="hover:underline">
                        {comment.post.title}
                      </Link>{" "}
                      · {formatDateTime(comment.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
