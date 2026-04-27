"use client";

import { useMemo } from "react";

type Props = {
  activity: Record<string, number>; // "YYYY-MM-DD" → count
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS   = ["", "Mon", "", "Wed", "", "Fri", ""];

function intensityColor(count: number): string {
  if (count === 0) return "var(--contribution-0, #161b22)";
  if (count <= 2)  return "var(--contribution-1, #0e4429)";
  if (count <= 5)  return "var(--contribution-2, #006d32)";
  if (count <= 9)  return "var(--contribution-3, #26a641)";
  return                  "var(--contribution-4, #39d353)";
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ContributionGraph({ activity, currentStreak, longestStreak, totalActiveDays }: Props) {
  // Build a 53-week × 7-day grid ending today
  const { weeks, monthLabels, totalContributions } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from the Sunday 52 full weeks ago
    const start = new Date(today);
    start.setDate(start.getDate() - (52 * 7) - start.getDay());

    const weeks: { date: string; count: number; future: boolean }[][] = [];
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    let cursor = new Date(start);
    let week: { date: string; count: number; future: boolean }[] = [];
    let col = 0;

    while (cursor <= today) {
      const dateStr = toDateStr(cursor);
      const count = activity[dateStr] ?? 0;
      const future = cursor > today;

      // Month label at start of each month
      const m = cursor.getMonth();
      if (m !== lastMonth && cursor.getDay() === 0) {
        monthLabels.push({ label: MONTHS[m], col });
        lastMonth = m;
      }

      week.push({ date: dateStr, count, future });

      if (cursor.getDay() === 6) {
        weeks.push(week);
        week = [];
        col++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }
    if (week.length > 0) {
      // pad to 7
      while (week.length < 7) week.push({ date: "", count: 0, future: true });
      weeks.push(week);
    }

    const totalContributions = Object.values(activity).reduce((a, b) => a + b, 0);
    return { weeks, monthLabels, totalContributions };
  }, [activity]);

  const CELL = 12;
  const GAP  = 3;
  const STEP  = CELL + GAP;
  const LEFT_PAD = 28; // space for day labels
  const TOP_PAD  = 18; // space for month labels
  const svgW  = LEFT_PAD + weeks.length * STEP;
  const svgH  = TOP_PAD  + 7 * STEP;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Streak badges */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="card" style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🔥</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "var(--orange, #f97316)", lineHeight: 1 }}>{currentStreak}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Current streak</div>
          </div>
        </div>
        <div className="card" style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "var(--purple)", lineHeight: 1 }}>{longestStreak}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Longest streak</div>
          </div>
        </div>
        <div className="card" style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📅</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "var(--green)", lineHeight: 1 }}>{totalActiveDays}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Active days</div>
          </div>
        </div>
        <div className="card" style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "var(--blue)", lineHeight: 1 }}>{totalContributions}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Total contributions</div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card" style={{ padding: "16px 20px", overflowX: "auto" }}>
        <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 10, fontWeight: 600 }}>
          {totalContributions} contributions in the last year
        </div>
        <svg width={svgW} height={svgH} style={{ display: "block" }}>
          {/* Month labels */}
          {monthLabels.map(({ label, col }) => (
            <text
              key={label + col}
              x={LEFT_PAD + col * STEP}
              y={TOP_PAD - 4}
              fill="var(--text-3)"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {/* Day labels */}
          {DAYS.map((d, i) => d && (
            <text
              key={d}
              x={LEFT_PAD - 6}
              y={TOP_PAD + i * STEP + CELL - 1}
              fill="var(--text-3)"
              fontSize={9}
              textAnchor="end"
            >
              {d}
            </text>
          ))}

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <rect
                key={`${wi}-${di}`}
                x={LEFT_PAD + wi * STEP}
                y={TOP_PAD + di * STEP}
                width={CELL}
                height={CELL}
                rx={2}
                fill={day.future || !day.date ? "transparent" : intensityColor(day.count)}
                style={{ cursor: day.count > 0 ? "pointer" : "default" }}
              >
                {day.date && <title>{day.date}: {day.count} contribution{day.count !== 1 ? "s" : ""}</title>}
              </rect>
            ))
          )}
        </svg>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>Less</span>
          {[0, 1, 3, 6, 10].map(n => (
            <rect
              key={n}
              style={{ width: 10, height: 10, borderRadius: 2, background: intensityColor(n), display: "inline-block" }}
            />
          ))}
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>More</span>
        </div>
      </div>
    </div>
  );
}
