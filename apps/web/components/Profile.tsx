"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

export function Profile() {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<any>("/api/me")
      .then((j) => setData(j))
      .catch((e) => setErr(String(e?.message || e)));
  }, []);

  if (err) return <div style={{ color: "#fca5a5" }}>{err}</div>;
  if (!data) return <div style={{ color: "#64748b" }}>Loading…</div>;

  const s = data.stats || {};

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
        <div style={{ fontWeight: 900 }}>Identity</div>
        <div style={{ color: "#94a3b8", marginTop: 6 }}>
          {data.user?.github ? `@${data.user.github}` : data.user?.email || data.user?.id}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Reputation</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{s.reputationPts ?? 0}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Bounty earned (pts)</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{s.bountyEarnedPts ?? 0}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Wins</div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>{s.bountiesWon ?? 0}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Submissions</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{s.submissionsCount ?? 0}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Avg submission score</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{s.avgSubmissionScore ?? 0}</div>
        </div>
      </div>
    </div>
  );
}

