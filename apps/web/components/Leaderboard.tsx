"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

type Mode = "attempts" | "reputation" | "earnings";

const MEDALS = ["🥇", "🥈", "🥉"];

function scoreColor(n: number) {
  if (n >= 75) return "var(--green)";
  if (n >= 50) return "var(--yellow)";
  return "var(--red)";
}

function Avatar({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: `hsl(${hue},55%,35%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 800, color: "#fff"
    }}>
      {initials}
    </div>
  );
}

export function Leaderboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("attempts");

  useEffect(() => {
    setRows([]);
    const path = mode === "attempts" ? "/api/leaderboard" : mode === "reputation" ? "/api/leaderboard/reputation" : "/api/leaderboard/earnings";
    apiGet<any>(path)
      .then((j) => setRows(j.top || []))
      .catch((e) => setErr(String(e?.message || e)));
  }, [mode]);

  const MODES: { key: Mode; label: string }[] = [
    { key: "attempts", label: "Top Scores" },
    { key: "reputation", label: "Reputation" },
    { key: "earnings", label: "Earners" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8 }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`btn sm ${mode === m.key ? "" : "secondary"}`}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {err && <div style={{ color: "var(--red)" }}>{err}</div>}

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>Developer</th>
              {mode === "attempts" && <th>Challenge</th>}
              {mode !== "attempts" && <th>Wins</th>}
              {mode !== "attempts" && <th>Submissions</th>}
              <th style={{ textAlign: "right" }}>{mode === "attempts" ? "Score" : mode === "reputation" ? "Reputation" : "Pts Earned"}</th>
            </tr>
          </thead>
          <tbody>
            {mode === "attempts"
              ? rows.map((r, i) => {
                  const name = r.user?.name || (r.user?.github ? `@${r.user.github}` : r.userId);
                  const sc = r.scoreTotal ?? 0;
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700, fontSize: 15, color: i < 3 ? undefined : "var(--text-3)" }}>
                        {i < 3 ? MEDALS[i] : `${i + 1}`}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={name} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                            <div style={{ color: "var(--text-3)", fontSize: 11 }}>{new Date(r.updatedAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-2)", fontSize: 13 }}>{r.challenge?.title ?? "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 800, fontSize: 18, color: scoreColor(sc) }}>{sc}</span>
                      </td>
                    </tr>
                  );
                })
              : rows.map((r, i) => {
                  const name = r.user?.name || (r.user?.github ? `@${r.user.github}` : r.userId);
                  const val = mode === "reputation" ? r.reputationPts : r.bountyEarnedPts;
                  return (
                    <tr key={r.userId}>
                      <td style={{ fontWeight: 700, fontSize: 15, color: i < 3 ? undefined : "var(--text-3)" }}>
                        {i < 3 ? MEDALS[i] : `${i + 1}`}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={name} />
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-2)", fontSize: 13 }}>{r.bountiesWon}</td>
                      <td style={{ color: "var(--text-2)", fontSize: 13 }}>{r.submissionsCount}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 800, fontSize: 18, color: "var(--blue)" }}>{val}</span>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
        {rows.length === 0 && !err && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)" }}>
            No data yet. Complete a challenge to appear here.
          </div>
        )}
      </div>
    </div>
  );
}
