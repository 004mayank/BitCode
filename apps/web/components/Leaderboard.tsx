"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

export function Leaderboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"attempts" | "reputation" | "earnings">("attempts");

  useEffect(() => {
    const path =
      mode === "attempts"
        ? "/api/leaderboard"
        : mode === "reputation"
          ? "/api/leaderboard/reputation"
          : "/api/leaderboard/earnings";
    apiGet<any>(path)
      .then((j) => setRows(j.top || []))
      .catch((e) => setErr(String(e?.message || e)));
  }, [mode]);

  if (err) return <div style={{ color: "#fca5a5" }}>{err}</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn secondary" onClick={() => setMode("attempts")}>
          Top Attempts
        </button>
        <button className="btn secondary" onClick={() => setMode("reputation")}>
          Top Reputation
        </button>
        <button className="btn secondary" onClick={() => setMode("earnings")}>
          Top Earners
        </button>
      </div>

      {mode === "attempts"
        ? rows.map((r) => (
            <div
              key={r.id}
              style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>{r.challenge?.title ?? "Challenge"}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#93c5fd" }}>{r.scoreTotal}</div>
              </div>
              <div style={{ color: "#94a3b8", marginTop: 6 }}>
                {r.user?.name || r.user?.github || r.userId} · {new Date(r.updatedAt).toLocaleString()}
              </div>
            </div>
          ))
        : rows.map((r) => (
            <div
              key={r.userId}
              style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>{r.user?.name || (r.user?.github ? `@${r.user.github}` : r.userId)}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#93c5fd" }}>
                  {mode === "reputation" ? r.reputationPts : r.bountyEarnedPts}
                </div>
              </div>
              <div style={{ color: "#94a3b8", marginTop: 6 }}>
                wins: {r.bountiesWon} · submissions: {r.submissionsCount} · avg: {r.avgSubmissionScore}
              </div>
            </div>
          ))}

      {!rows.length ? <div style={{ color: "#64748b" }}>No data yet.</div> : null}
    </div>
  );
}
