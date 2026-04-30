"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

type Challenge = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
};

const DIFF_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: "Easy", color: "green" },
  2: { label: "Easy+", color: "green" },
  3: { label: "Medium", color: "yellow" },
  4: { label: "Hard", color: "red" },
  5: { label: "Expert", color: "purple" },
};

// Display labels for tags (proper capitalisation, no emojis)
const TAG_LABELS: Record<string, string> = {
  ai:          "AI",
  rag:         "RAG",
  agents:      "Agents",
  security:    "Security",
  backend:     "Backend",
  frontend:    "Frontend",
  debugging:   "Debugging",
  performance: "Performance",
  database:    "Database",
  devops:      "DevOps",
  evaluation:  "Evaluation",
  testing:     "Testing",
};

function tagLabel(t: string) {
  return TAG_LABELS[t] ?? (t.charAt(0).toUpperCase() + t.slice(1));
}

function DiffBadge({ d }: { d: number }) {
  const info = DIFF_LABEL[d] ?? { label: `L${d}`, color: "gray" };
  return <span className={`badge ${info.color}`}>{info.label}</span>;
}

const FILTERS = ["All", "ai", "debugging", "backend", "frontend", "security", "database", "devops"];

export function ChallengesList() {
  const [items, setItems] = useState<Challenge[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiGet<{ ok: true; challenges: Challenge[] }>("/api/challenges")
      .then((j) => setItems(j.challenges))
      .catch((e) => setErr(String(e?.message || e)));
  }, []);

  const filtered = items.filter((c) => {
    const matchTag = filter === "All" || c.tags.includes(filter);
    const q = search.toLowerCase().trim();
    const matchSearch = !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q));
    return matchTag && matchSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Challenges</div>
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
            {items.length} real-world problems · Use AI, get scored
          </div>
        </div>
        <input
          className="input"
          style={{ maxWidth: 220 }}
          placeholder="Search challenges…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`btn sm ${filter === f ? "" : "secondary"}`}
            onClick={() => setFilter(f)}
          >
            {f === "All" ? "All" : tagLabel(f)}
          </button>
        ))}
      </div>

      {err ? <div style={{ color: "var(--red)", marginBottom: 12 }}>{err}</div> : null}

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {filtered.map((c) => (
          <a
            key={c.id}
            href={`/challenges/${c.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div className="card card-hover" style={{ padding: 18, height: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4, flex: 1 }}>{c.title}</div>
                <DiffBadge d={c.difficulty} />
              </div>
              <div style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6, flex: 1 }}>{c.description}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
                {c.tags.slice(0, 5).map((t) => (
                  <span key={t} className="tag">{tagLabel(t)}</span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 2 }}>
                <span style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600 }}>Start challenge →</span>
              </div>
            </div>
          </a>
        ))}
        {filtered.length === 0 && !err && (
          <div style={{ color: "var(--text-3)", gridColumn: "1 / -1", padding: 24, textAlign: "center" }}>
            No challenges match your filter.
          </div>
        )}
      </div>
    </div>
  );
}
