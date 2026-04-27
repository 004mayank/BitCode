"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

type Bounty = {
  id: string;
  title: string;
  description: string;
  status: string;
  rewardPts: number;
  rewardType: string;
  deadline?: string | null;
  challenge?: { title: string; difficulty: number; tags: string[] } | null;
  org?: { name: string; slug: string } | null;
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    OPEN: "green",
    DRAFT: "gray",
    SUBMISSIONS_CLOSED: "yellow",
    REVIEWING: "yellow",
    AWARDED: "purple",
    CANCELLED: "red",
  };
  return <span className={`badge ${map[s] ?? "gray"}`}>{s.replace("_", " ")}</span>;
}

function diffDays(deadline: string) {
  const d = new Date(deadline).getTime() - Date.now();
  if (d < 0) return "Expired";
  const days = Math.ceil(d / 86400000);
  return days === 1 ? "1 day left" : `${days} days left`;
}

const FILTERS = ["All", "OPEN", "REVIEWING", "AWARDED"];

export function Bounties() {
  const [items, setItems] = useState<Bounty[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiGet<any>("/api/bounties")
      .then((j) => setItems(j.bounties || []))
      .catch((e) => setErr(String(e?.message || e)));
  }, []);

  const filtered = items.filter((b) => {
    const matchStatus = filter === "All" || b.status === filter;
    const q = search.toLowerCase().trim();
    const matchSearch = !q || b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const openCount = items.filter((b) => b.status === "OPEN").length;
  const totalPts = items.filter((b) => b.status === "OPEN").reduce((s, b) => s + b.rewardPts, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <StatTile label="Open Bounties" value={openCount} color="var(--green)" />
        <StatTile label="Points Available" value={totalPts} color="var(--blue)" />
        <StatTile label="Total Posted" value={items.length} color="var(--text-2)" />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f} className={`btn sm ${filter === f ? "" : "secondary"}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
        <input
          className="input"
          style={{ maxWidth: 220, marginLeft: "auto" }}
          placeholder="Search bounties…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {err && <div style={{ color: "var(--red)" }}>{err}</div>}

      {/* Bounty cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((b) => (
          <a key={b.id} href={`/bounties/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card card-hover" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                {/* Reward badge */}
                <div style={{
                  background: b.status === "OPEN" ? "var(--green-dim)" : "rgba(148,163,184,0.06)",
                  border: `1px solid ${b.status === "OPEN" ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  textAlign: "center",
                  minWidth: 70,
                  flexShrink: 0
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: b.status === "OPEN" ? "var(--green)" : "var(--text-3)" }}>{b.rewardPts}</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>pts</div>
                </div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{b.title}</div>
                    {statusBadge(b.status)}
                    {b.org && <span style={{ fontSize: 12, color: "var(--text-3)" }}>by {b.org.name}</span>}
                  </div>
                  <div style={{ color: "var(--text-2)", marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>{b.description}</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {b.challenge && (
                      <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                        Challenge: <span style={{ color: "var(--text-2)" }}>{b.challenge.title}</span>
                      </span>
                    )}
                    {b.deadline && (
                      <span style={{ fontSize: 12, color: new Date(b.deadline) < new Date() ? "var(--red)" : "var(--yellow)" }}>
                        ⏱ {diffDays(b.deadline)}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--blue)", marginLeft: "auto", fontWeight: 600 }}>
                      {b.status === "OPEN" ? "Submit →" : "View →"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </a>
        ))}
        {filtered.length === 0 && !err && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
            No bounties match your filter.
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}
