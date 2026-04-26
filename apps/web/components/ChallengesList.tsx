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

export function ChallengesList() {
  const [items, setItems] = useState<Challenge[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ ok: true; challenges: Challenge[] }>("/api/challenges")
      .then((j) => setItems(j.challenges))
      .catch((e) => setErr(String(e?.message || e)));
  }, []);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Challenges</div>
      </div>
      {err ? <div style={{ color: "#fca5a5", marginTop: 10 }}>{err}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 }}>
        {items.map((c) => (
          <a
            key={c.id}
            href={`/challenges/${c.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{ padding: 12, border: "1px solid rgba(148,163,184,.18)", borderRadius: 12, background: "#0b1220" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>{c.title}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Difficulty {c.difficulty}</div>
              </div>
              <div style={{ color: "#94a3b8", marginTop: 6 }}>{c.description}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {c.tags?.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    style={{ fontSize: 12, color: "#93c5fd", border: "1px solid rgba(147,197,253,.25)", padding: "2px 8px", borderRadius: 999 }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

