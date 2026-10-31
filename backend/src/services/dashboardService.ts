import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 삭제되지 않은 댓글 중, 게시글도 삭제되지 않은 것 (삭제된 글의 댓글은 어디에도 노출되지 않는다) */
const VISIBLE_COMMENT = { deletedAt: null, post: { deletedAt: null } } satisfies Prisma.CommentWhereInput;

/** 조회수 추이 차트 기간 (오늘 포함 최근 N일) */
const TREND_DAYS = 14;
/** 일별 집계 기준 시간대 — 블로그 운영 기준(한국 시간) 자정으로 날짜를 나눈다 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 오늘(KST)을 포함한 최근 N일의 "YYYY-MM-DD" 목록과, 그 첫날 KST 자정의 UTC 시각 */
function kstDayRange(days: number): { dayKeys: string[]; since: Date } {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  const todayUtcMidnight = Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate());

  const dayKeys = Array.from({ length: days }, (_, i) =>
    new Date(todayUtcMidnight - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
  const since = new Date(todayUtcMidnight - (days - 1) * 86_400_000 - KST_OFFSET_MS);

  return { dayKeys, since };
}

/**
 * GET /api/admin/dashboard — 운영 현황 통계
 * - totals: 회원/게시글/댓글 수(삭제 제외), 총 조회수(viewCount 합)
 * - viewTrend: 최근 14일 일별 조회수 — PostView(게시글+IP 첫 조회 기록)를 KST 날짜별로 센다.
 *   viewCount도 PostView가 새로 생길 때만 +1 되므로 두 숫자의 기준이 같다.
 */
export async function getDashboardStats() {
  const { dayKeys, since } = kstDayRange(TREND_DAYS);

  const [totalUsers, totalPosts, viewSum, totalComments, popularPosts, recentComments, trendRows] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.post.aggregate({ where: { deletedAt: null }, _sum: { viewCount: true } }),
      prisma.comment.count({ where: VISIBLE_COMMENT }),
      prisma.post.findMany({
        where: { deletedAt: null, status: "PUBLISHED" },
        orderBy: { viewCount: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          author: { select: { id: true, name: true } },
          _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
        },
      }),
      prisma.comment.findMany({
        where: VISIBLE_COMMENT,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          content: true,
          createdAt: true,
          guestName: true,
          user: { select: { id: true, name: true } },
          post: { select: { title: true, slug: true } },
        },
      }),
      // 날짜를 문자열로 받아야 pg 드라이버의 Date 변환(서버 로컬 시간대)에 흔들리지 않는다.
      // viewedAt은 Prisma가 UTC로 저장한 timestamp(시간대 없음)라 UTC → KST 순서로 변환한다.
      // 삭제된 글의 조회 기록은 제외한다 — totals.views(삭제 안 된 글의 viewCount 합)와 기준을 맞추기 위해.
      prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT TO_CHAR((pv."viewedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
               COUNT(*)::bigint AS count
        FROM "post_views" pv
        JOIN "posts" p ON p."id" = pv."postId"
        WHERE pv."viewedAt" >= ${since} AND p."deletedAt" IS NULL
        GROUP BY day
        ORDER BY day`,
    ]);

  // 조회가 없던 날도 0으로 채워야 차트의 x축 간격이 일정하다.
  const countsByDay = new Map(trendRows.map((row) => [row.day, Number(row.count)]));
  const viewTrend = dayKeys.map((date) => ({ date, views: countsByDay.get(date) ?? 0 }));

  return {
    totals: {
      users: totalUsers,
      posts: totalPosts,
      views: viewSum._sum.viewCount ?? 0,
      comments: totalComments,
    },
    popularPosts: popularPosts.map(({ _count, ...post }) => ({
      ...post,
      likeCount: _count.likes,
      commentCount: _count.comments,
    })),
    recentComments,
    viewTrend,
  };
}
