"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "./api";

export function Bounties() {
  const [items, setItems] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ challengeId: "", title: "", description: "", rewardPts: 250 });

  async function load() {
    const j = await apiGet<any>("/api/bounties");
    setItems(j.bounties || []);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e?.message || e)));
  }, []);

  async function create() {
    setErr(null);
    await apiPost("/api/bounties", form);
    setForm({ challengeId: "", title: "", description: "", rewardPts: 250 });
    await load();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
      <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
        <div style={{ fontWeight: 800 }}>Create bounty (admin-only in real product)</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input
            className="input"
            placeholder="Challenge ID (copy from /)"
            value={form.challengeId}
            onChange={(e) => setForm((f) => ({ ...f, challengeId: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="textarea"
            rows={3}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <input
            className="input"
            type="number"
            placeholder="Reward points"
            value={form.rewardPts}
            onChange={(e) => setForm((f) => ({ ...f, rewardPts: Number(e.target.value) }))}
          />
          <button className="btn" onClick={create} disabled={!form.challengeId || !form.title || !form.description}>
            Create bounty
          </button>
          {err ? <div style={{ color: "#fca5a5" }}>{err}</div> : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {items.map((b) => (
          <div key={b.id} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>{b.title}</div>
              <div style={{ color: "#93c5fd", fontWeight: 900 }}>{b.rewardPts} pts</div>
            </div>
            <div style={{ color: "#94a3b8", marginTop: 6 }}>{b.description}</div>
            <div style={{ color: "#64748b", marginTop: 8, fontSize: 13 }}>
              Challenge: {b.challenge?.title ?? b.challengeId}
            </div>
          </div>
        ))}
        {!items.length ? <div style={{ color: "#64748b" }}>No bounties yet.</div> : null}
      </div>
    </div>
  );
}

