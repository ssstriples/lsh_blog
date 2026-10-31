"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

interface TrendPoint {
  date: string; // "YYYY-MM-DD" (KST)
  views: number;
}

const SERIES = "var(--viz-series-1)";
const SURFACE = "var(--viz-surface)";

/** "2026-10-31" → "10/31" */
function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** "2026-10-31" → "10월 31일 (금)" */
function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

const compact = new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 1 });

/** 툴팁: 값이 주인공(굵게), 날짜는 보조 — 시리즈 표시는 박스 대신 짧은 선(line key) */
function TrendTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0].value ?? 0);

  return (
    <div className="bg-popover rounded-lg border px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground text-xs">{longDate(String(label))}</p>
      <p className="mt-1 flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: SERIES }} />
        <strong className="text-foreground font-semibold">{value.toLocaleString("ko-KR")}</strong>
        <span className="text-muted-foreground">조회</span>
      </p>
    </div>
  );
}

/**
 * 최근 14일 일별 조회수 — 단일 시리즈라 범례 없이 제목이 무엇을 그렸는지 말한다.
 * 색은 globals.css의 `.viz-root` 토큰(라이트/다크 각각 Card 표면 기준으로 검증된 blue)을 쓴다.
 */
export function ViewTrendChart({ data }: { data: TrendPoint[] }) {
  const lastIndex = data.length - 1;
  const last = data[lastIndex];
  const total = data.reduce((sum, point) => sum + point.views, 0);

  return (
    <figure className="viz-root flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">일별 조회수 (최근 14일)</span>
        <span className="text-muted-foreground text-sm">
          합계 {total.toLocaleString("ko-KR")}회 · 게시글별 첫 방문 기준
        </span>
      </figcaption>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 40, bottom: 0, left: 0 }}>
            {/* 수평 hairline만, 실선 — 데이터보다 조용하게 */}
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: "var(--viz-ink-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--viz-axis)" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, (max: number) => Math.max(4, max)]}
              tickFormatter={(value: number) => compact.format(value)}
              tick={{ fill: "var(--viz-ink-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            {/* 크로스헤어: 세로 hairline이 가장 가까운 날짜에 붙는다 */}
            <Tooltip
              content={TrendTooltip}
              cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Area
              type="linear" // 일별 이산 값 — 곡선 보간은 없던 중간값을 암시하므로 직선으로 잇는다
              dataKey="views"
              name="조회수"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill={SERIES}
              fillOpacity={0.1}
              isAnimationActive={false}
              // 끝점만 표시: 8px 점 + 2px 표면색 링, 값은 시리즈 색이 아닌 본문 잉크로 직접 라벨링
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === lastIndex && props.cx != null && props.cy != null ? (
                  <g key="end-dot">
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={SERIES}
                      stroke={SURFACE}
                      strokeWidth={2}
                    />
                    <text
                      x={props.cx + 8}
                      y={props.cy}
                      dominantBaseline="middle"
                      className="fill-foreground text-xs font-semibold"
                    >
                      {last.views.toLocaleString("ko-KR")}
                    </text>
                  </g>
                ) : (
                  <g key={`dot-${props.index}`} />
                )
              }
              activeDot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 툴팁 없이도 모든 값을 볼 수 있도록 — 키보드/스크린리더/색각 이상 사용자용 표 */}
      <details className="text-sm">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
          표로 보기
        </summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="py-1 font-medium">날짜</th>
              <th className="py-1 text-right font-medium">조회수</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date} className="border-b last:border-0">
                <td className="py-1">{longDate(point.date)}</td>
                <td className="py-1 text-right tabular-nums">
                  {point.views.toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
