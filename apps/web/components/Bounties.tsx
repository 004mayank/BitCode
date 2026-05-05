"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

// ─── Internal bounties ────────────────────────────────────────────────────────

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

// ─── External bounties ────────────────────────────────────────────────────────

type ExternalBounty = {
  id: string;
  source: string;
  title: string;
  description: string;
  url: string;
  company: string;
  logoUrl?: string | null;
  type: string;
  tags: string[];
  isOpen: boolean;
  rewardMin?: number | null;
  rewardMax?: number | null;
  rewardLabel?: string | null;
  currency: string;
  deadline?: string | null;
  fetchedAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const SOURCE_META: Record<string, { label: string; color: string }> = {
  ALGORA:     { label: "Algora",     color: "#7c3aed" },
  ISSUEHUNT:  { label: "IssueHunt",  color: "#0ea5e9" },
  HACKERONE:  { label: "HackerOne",  color: "#f97316" },
  INTIGRITI:  { label: "Intigriti",  color: "#ec4899" },
  IMMUNEFI:   { label: "Immunefi",   color: "#10b981" },
  GITCOIN:    { label: "Gitcoin",    color: "#06b6d4" },
  OTHER:      { label: "Other",      color: "#64748b" },
};

const TYPE_META: Record<string, { label: string; emoji: string }> = {
  OSS:        { label: "OSS",        emoji: "🛠" },
  BUG_BOUNTY: { label: "Bug Bounty", emoji: "🐛" },
  GRANT:      { label: "Grant",      emoji: "💰" },
};

const INTERNAL_FILTERS = ["All", "OPEN", "REVIEWING", "AWARDED"];
const EXTERNAL_TYPES   = ["All", "OSS", "BUG_BOUNTY", "GRANT"];

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

// ─── Internal bounties panel ──────────────────────────────────────────────────

function InternalBounties() {
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
  const totalPts  = items.filter((b) => b.status === "OPEN").reduce((s, b) => s + b.rewardPts, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <StatTile label="Open Bounties"   value={openCount}    color="var(--green)"  />
        <StatTile label="Points Available" value={totalPts}    color="var(--blue)"   />
        <StatTile label="Total Posted"     value={items.length} color="var(--text-2)" />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {INTERNAL_FILTERS.map((f) => (
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((b) => (
          <a key={b.id} href={`/bounties/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="card card-hover" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{
                  background: b.status === "OPEN" ? "var(--green-dim)" : "rgba(148,163,184,0.06)",
                  border: `1px solid ${b.status === "OPEN" ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  textAlign: "center",
                  minWidth: 70,
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: b.status === "OPEN" ? "var(--green)" : "var(--text-3)" }}>{b.rewardPts}</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>pts</div>
                </div>

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

// ─── Application tracking types & helpers ─────────────────────────────────────

type AppStatus = "SAVED" | "APPLIED" | "IN_PROGRESS" | "SUBMITTED" | "WON" | "LOST";

interface AppRecord {
  externalBountyId: string;
  status: AppStatus;
  submissionUrl?: string | null;
  notes?: string | null;
}

const STATUS_META: Record<AppStatus, { label: string; emoji: string; color: string }> = {
  SAVED:       { label: "Saved",       emoji: "🔖", color: "#94a3b8" },
  APPLIED:     { label: "Applied",     emoji: "📨", color: "#60a5fa" },
  IN_PROGRESS: { label: "In Progress", emoji: "⚙️",  color: "#f59e0b" },
  SUBMITTED:   { label: "Submitted",   emoji: "✅", color: "#34d399" },
  WON:         { label: "Won! 🎉",     emoji: "🏆", color: "#10b981" },
  LOST:        { label: "Closed",      emoji: "❌", color: "#f87171" },
};

const ALL_STATUSES: AppStatus[] = ["SAVED", "APPLIED", "IN_PROGRESS", "SUBMITTED", "WON", "LOST"];

// ─── Tracker popover ──────────────────────────────────────────────────────────

function TrackerPanel({
  bountyId,
  current,
  onSave,
  onRemove,
  onClose,
}: {
  bountyId: string;
  current: AppRecord | undefined;
  onSave: (status: AppStatus, submissionUrl: string, notes: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [status, setStatus]  = useState<AppStatus>(current?.status ?? "SAVED");
  const [url, setUrl]        = useState(current?.submissionUrl ?? "");
  const [notes, setNotes]    = useState(current?.notes ?? "");
  const [saving, setSaving]  = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(status, url, notes);
    setSaving(false);
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 12,
        padding: "14px 16px",
        background: "var(--surface-1, rgba(15,23,42,0.95))",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Track your progress
      </div>

      {/* Status buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ALL_STATUSES.map((s) => {
          const m = STATUS_META[s];
          const active = status === s;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: "5px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                border: `1px solid ${active ? m.color : "var(--border)"}`,
                background: active ? m.color + "22" : "transparent",
                color: active ? m.color : "var(--text-3)",
                transition: "all 0.15s",
              }}
            >
              {m.emoji} {m.label}
            </button>
          );
        })}
      </div>

      {/* Submission URL — show when submitted/won */}
      {(status === "SUBMITTED" || status === "WON") && (
        <input
          className="input"
          placeholder="Submission / PR / report URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ fontSize: 13 }}
        />
      )}

      {/* Notes */}
      <textarea
        className="input"
        placeholder="Private notes (optional)…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        style={{ fontSize: 13, resize: "vertical" }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn sm"
          onClick={handleSave}
          disabled={saving}
          style={{ flex: 1 }}
        >
          {saving ? "Saving…" : current ? "Update" : "Save"}
        </button>
        {current && (
          <button
            className="btn sm secondary"
            onClick={onRemove}
            style={{ color: "var(--red)" }}
          >
            Remove
          </button>
        )}
        <button className="btn sm secondary" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── External bounties panel ──────────────────────────────────────────────────

function ExternalBounties() {
  const [items, setItems]         = useState<ExternalBounty[]>([]);
  const [total, setTotal]         = useState(0);
  const [lastSync, setLastSync]   = useState<string | null>(null);
  const [err, setErr]             = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [typeFilter, setTypeFilter] = useState("All");
  const [showTracked, setShowTracked] = useState(false);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const limit = 50;

  // Tracking state: bountyId → AppRecord
  const [tracking, setTracking]   = useState<Record<string, AppRecord>>({});
  const [openTracker, setOpenTracker] = useState<string | null>(null);

  // Load bounties
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (typeFilter !== "All") params.set("type", typeFilter);
    if (search.trim()) params.set("q", search.trim());

    fetch(`/api/external-bounties?${params}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: any) => {
        setItems(j.bounties ?? []);
        setTotal(j.total ?? 0);
        setLastSync(j.lastSyncedAt ?? null);
        setErr(null);
      })
      .catch((e) => setErr(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, [typeFilter, page]);

  // Load user's tracked applications
  useEffect(() => {
    fetch("/api/external-applications", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((j: any) => {
        if (!j) return;
        const map: Record<string, AppRecord> = {};
        for (const a of j.applications ?? []) map[a.externalBountyId] = a;
        setTracking(map);
      })
      .catch(() => {});
  }, []);

  async function saveTracking(bountyId: string, status: AppStatus, submissionUrl: string, notes: string) {
    const res = await fetch("/api/external-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalBountyId: bountyId, status, submissionUrl: submissionUrl || null, notes: notes || null }),
    });
    if (res.ok) {
      const j = await res.json();
      setTracking((prev) => ({ ...prev, [bountyId]: j.application }));
    }
    setOpenTracker(null);
  }

  async function removeTracking(bountyId: string) {
    await fetch("/api/external-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalBountyId: bountyId, status: null }),
    });
    setTracking((prev) => {
      const next = { ...prev };
      delete next[bountyId];
      return next;
    });
    setOpenTracker(null);
  }

  const filtered = items.filter((b) => {
    if (showTracked && !tracking[b.id]) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.company.toLowerCase().includes(q) || b.tags.some((t) => t.toLowerCase().includes(q));
  });

  const trackedCount = Object.keys(tracking).length;
  const ossCount     = items.filter((b) => b.type === "OSS").length;
  const bugCount     = items.filter((b) => b.type === "BUG_BOUNTY").length;
  const grantCount   = items.filter((b) => b.type === "GRANT").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatTile label="Total Listings"  value={total}        color="var(--blue)"   />
        <StatTile label="OSS Bounties"    value={ossCount}     color="var(--green)"  />
        <StatTile label="Bug Bounties"    value={bugCount}     color="var(--yellow)" />
        <StatTile label="Tracking"        value={trackedCount} color="#7c3aed"        />
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {EXTERNAL_TYPES.map((t) => (
          <button
            key={t}
            className={`btn sm ${typeFilter === t && !showTracked ? "" : "secondary"}`}
            onClick={() => { setTypeFilter(t); setShowTracked(false); setPage(1); }}
          >
            {t === "All" ? "All" : TYPE_META[t]?.emoji + " " + TYPE_META[t]?.label}
          </button>
        ))}
        <button
          className={`btn sm ${showTracked ? "" : "secondary"}`}
          onClick={() => setShowTracked((v) => !v)}
          style={{ color: showTracked ? "#7c3aed" : undefined }}
        >
          🔖 My Tracked {trackedCount > 0 ? `(${trackedCount})` : ""}
        </button>
        <input
          className="input"
          style={{ maxWidth: 200, marginLeft: "auto" }}
          placeholder="Search…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {lastSync && (
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          Last synced: {new Date(lastSync).toLocaleString()}
        </div>
      )}
      {err && <div style={{ color: "var(--red)" }}>{err}</div>}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading external bounties…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
          {showTracked ? "You haven't tracked any bounties yet." : total === 0 ? "No bounties synced yet." : "No results match your filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((b) => {
            const src     = SOURCE_META[b.source] ?? SOURCE_META.OTHER;
            const tp      = TYPE_META[b.type] ?? { label: b.type, emoji: "•" };
            const app     = tracking[b.id];
            const appMeta = app ? STATUS_META[app.status] : null;
            const isOpen  = openTracker === b.id;

            return (
              <div key={b.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  {/* Company logo */}
                  <div style={{
                    width: 48, height: 48, borderRadius: 10, overflow: "hidden", flexShrink: 0,
                    background: "rgba(148,163,184,0.08)", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 20, border: "1px solid var(--border)",
                  }}>
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.company}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : b.company.charAt(0).toUpperCase()}
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{b.title}</div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                        background: src.color + "22", color: src.color, border: `1px solid ${src.color}44`,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>{src.label}</span>
                      <span style={{
                        fontSize: 11, color: "var(--text-3)", background: "rgba(148,163,184,0.08)",
                        padding: "2px 7px", borderRadius: 20, border: "1px solid var(--border)",
                      }}>{tp.emoji} {tp.label}</span>
                      {/* Tracked status badge */}
                      {appMeta && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: appMeta.color + "22", color: appMeta.color,
                          border: `1px solid ${appMeta.color}44`,
                        }}>{appMeta.emoji} {appMeta.label}</span>
                      )}
                    </div>

                    <div style={{ color: "var(--text-3)", marginTop: 3, fontSize: 12 }}>{b.company}</div>

                    {b.description && (
                      <div style={{ color: "var(--text-2)", marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                        {b.description.slice(0, 160)}{b.description.length > 160 ? "…" : ""}
                      </div>
                    )}

                    {/* Submission URL if tracked */}
                    {app?.submissionUrl && (
                      <a href={app.submissionUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "var(--blue)", display: "block", marginTop: 4 }}
                        onClick={(e) => e.stopPropagation()}>
                        🔗 My submission ↗
                      </a>
                    )}

                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      {b.rewardLabel && (
                        <span style={{
                          fontSize: 13, fontWeight: 700, color: "var(--green)",
                          background: "var(--green-dim)", padding: "3px 10px", borderRadius: 8,
                          border: "1px solid rgba(16,185,129,0.25)",
                        }}>{b.rewardLabel}</span>
                      )}
                      {b.tags.slice(0, 3).map((tag) => (
                        <span key={tag} style={{
                          fontSize: 11, color: "var(--text-3)", padding: "1px 6px",
                          background: "rgba(148,163,184,0.06)", borderRadius: 6, border: "1px solid var(--border)",
                        }}>{tag}</span>
                      ))}
                      {b.deadline && (
                        <span style={{ fontSize: 12, color: new Date(b.deadline) < new Date() ? "var(--red)" : "var(--yellow)" }}>
                          ⏱ {diffDays(b.deadline)}
                        </span>
                      )}

                      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                        {/* Track button */}
                        <button
                          className="btn sm secondary"
                          onClick={() => setOpenTracker(isOpen ? null : b.id)}
                          style={{
                            fontSize: 12,
                            color: app ? appMeta?.color : "var(--text-3)",
                            borderColor: app ? appMeta?.color + "66" : undefined,
                          }}
                        >
                          {app ? `${appMeta?.emoji} Tracking` : "🔖 Track"}
                        </button>
                        {/* Apply link */}
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--blue)", fontWeight: 600, textDecoration: "none" }}
                          onClick={() => {
                            // Auto-save APPLIED status when they click through (if not already tracked)
                            if (!app) {
                              saveTracking(b.id, "APPLIED", "", "");
                            }
                          }}
                        >
                          Apply ↗
                        </a>
                      </div>
                    </div>

                    {/* Tracker panel (inline, opens below) */}
                    {isOpen && (
                      <TrackerPanel
                        bountyId={b.id}
                        current={app}
                        onSave={(status, url, notes) => saveTracking(b.id, status, url, notes)}
                        onRemove={() => removeTracking(b.id)}
                        onClose={() => setOpenTracker(null)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > limit && !showTracked && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", paddingTop: 8 }}>
          <button className="btn sm secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>Page {page} of {Math.ceil(total / limit)}</span>
          <button className="btn sm secondary" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── Main Bounties component (tabbed) ─────────────────────────────────────────

export function Bounties() {
  const [tab, setTab] = useState<"internal" | "external">("internal");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {(["internal", "external"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              padding: "8px 18px",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? "var(--blue)" : "var(--text-2)",
              borderBottom: `2px solid ${tab === t ? "var(--blue)" : "transparent"}`,
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {t === "internal" ? "🏆 BitCode Bounties" : "🌐 Real-World Bounties"}
          </button>
        ))}
      </div>

      {tab === "internal" ? <InternalBounties /> : <ExternalBounties />}
    </div>
  );
}
