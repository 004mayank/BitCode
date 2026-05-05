"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERNSHIP" | "FREELANCE";
type JobStatus = "DRAFT" | "OPEN" | "CLOSED" | "FILLED";
type CandidateStatus = "NEW" | "VIEWED" | "SHORTLISTED" | "CONTACTED" | "REJECTED";

interface Job {
  id: string;
  createdAt: string;
  company: string;
  logoUrl?: string | null;
  title: string;
  description: string;
  location?: string | null;
  remote: boolean;
  jobType: JobType;
  tags: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency: string;
  applyUrl?: string | null;
  status: JobStatus;
  postedBy?: { id: string; name?: string | null; image?: string | null };
  _count?: { candidates: number };
}

interface UsageHit {
  repo: string;
  repoUrl: string;
  file: string;
  packagesFound: string[];
}

interface Candidate {
  id: string;
  githubLogin: string;
  userId?: string | null;
  githubName?: string | null;
  githubAvatar?: string | null;
  githubBio?: string | null;
  githubUrl?: string | null;
  followers: number;
  publicRepos: number;
  matchScore: number;
  ecosystemScore: number;
  usageScore: number;
  popularityScore: number;
  bitcodeScore: number;
  matchedRepos?: Array<{ name: string; url: string; stars: number }> | null;
  matchedSkills: string[];
  usageEvidence?: UsageHit[] | null;
  status: CandidateStatus;
  hrNotes?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOB_TYPE_LABEL: Record<JobType, string> = {
  FULL_TIME: "Full-time", PART_TIME: "Part-time",
  CONTRACT: "Contract", INTERNSHIP: "Internship", FREELANCE: "Freelance",
};

const CANDIDATE_STATUS_META: Record<CandidateStatus, { label: string; color: string }> = {
  NEW:         { label: "New",         color: "#94a3b8" },
  VIEWED:      { label: "Viewed",      color: "#60a5fa" },
  SHORTLISTED: { label: "Shortlisted", color: "#f59e0b" },
  CONTACTED:   { label: "Contacted",   color: "#34d399" },
  REJECTED:    { label: "Rejected",    color: "#f87171" },
};

function salaryLabel(min?: number | null, max?: number | null, currency = "USD") {
  const fmt = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const days = Math.floor(d / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Post Job form ────────────────────────────────────────────────────────────

function PostJobForm({ onPosted }: { onPosted: (job: Job) => void }) {
  const [form, setForm] = useState({
    title: "", company: "", description: "", location: "", remote: true,
    jobType: "FULL_TIME" as JobType, tags: "", salaryMin: "", salaryMax: "", applyUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set(k: string, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          salaryMin: form.salaryMin ? Math.round(parseFloat(form.salaryMin) * 100) : null,
          salaryMax: form.salaryMax ? Math.round(parseFloat(form.salaryMax) * 100) : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed to post job");
      onPosted(j.job);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Post a Job</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Job Title *</label>
          <input className="input" placeholder="e.g. Senior ML Engineer" value={form.title}
            onChange={(e) => set("title", e.target.value)} required />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Company *</label>
          <input className="input" placeholder="e.g. Acme Corp" value={form.company}
            onChange={(e) => set("company", e.target.value)} required />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Description *</label>
        <textarea className="input" rows={4} placeholder="Describe the role, responsibilities, requirements…"
          value={form.description} onChange={(e) => set("description", e.target.value)} required
          style={{ resize: "vertical" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Type</label>
          <select className="input" value={form.jobType} onChange={(e) => set("jobType", e.target.value)}>
            {Object.entries(JOB_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Location</label>
          <input className="input" placeholder="e.g. San Francisco" value={form.location}
            onChange={(e) => set("location", e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={form.remote} onChange={(e) => set("remote", e.target.checked)} />
            Remote OK
          </label>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
          Skills / Tech Tags *
          <span style={{ fontWeight: 400, marginLeft: 6, color: "var(--text-3)" }}>
            (comma-separated, used to find candidates on GitHub)
          </span>
        </label>
        <input className="input" placeholder="e.g. python, langchain, rag, vector-database, llm"
          value={form.tags} onChange={(e) => set("tags", e.target.value)} required />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Min Salary (USD/yr)</label>
          <input className="input" type="number" placeholder="e.g. 120000" value={form.salaryMin}
            onChange={(e) => set("salaryMin", e.target.value)} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Max Salary (USD/yr)</label>
          <input className="input" type="number" placeholder="e.g. 180000" value={form.salaryMax}
            onChange={(e) => set("salaryMax", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>Apply / Contact URL</label>
        <input className="input" type="url" placeholder="https://…" value={form.applyUrl}
          onChange={(e) => set("applyUrl", e.target.value)} />
      </div>

      {err && <div style={{ color: "var(--red)", fontSize: 13 }}>{err}</div>}

      <button className="btn" type="submit" disabled={saving} style={{ alignSelf: "flex-start" }}>
        {saving ? "Posting…" : "Post Job & Find Candidates →"}
      </button>
    </form>
  );
}

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({
  c, jobId, onUpdate,
}: {
  c: Candidate; jobId: string; onUpdate: (updated: Candidate) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes]   = useState(c.hrNotes ?? "");
  const [showNotes, setShowNotes] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const meta = CANDIDATE_STATUS_META[c.status];
  const repos = (c.matchedRepos as any[]) ?? [];
  const evidence = (c.usageEvidence as UsageHit[] | null) ?? [];

  async function updateStatus(status: CandidateStatus) {
    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/candidates`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: c.id, status }),
    });
    if (res.ok) { const j = await res.json(); onUpdate(j.candidate); }
    setSaving(false);
  }

  async function saveNotes() {
    setSaving(true);
    const res = await fetch(`/api/jobs/${jobId}/candidates`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId: c.id, hrNotes: notes }),
    });
    if (res.ok) { const j = await res.json(); onUpdate(j.candidate); }
    setSaving(false);
    setShowNotes(false);
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Avatar */}
        <a href={c.githubUrl ?? `https://github.com/${c.githubLogin}`} target="_blank" rel="noopener noreferrer">
          <img
            src={c.githubAvatar ?? `https://github.com/${c.githubLogin}.png`}
            alt={c.githubLogin}
            style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid var(--border)", flexShrink: 0 }}
          />
        </a>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <a href={c.githubUrl ?? `https://github.com/${c.githubLogin}`} target="_blank" rel="noopener noreferrer"
              style={{ fontWeight: 700, fontSize: 15, color: "inherit", textDecoration: "none" }}>
              {c.githubName ?? c.githubLogin}
            </a>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>@{c.githubLogin}</span>

            {/* BitCode badge */}
            {c.userId && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: "rgba(59,130,246,0.15)", color: "#60a5fa",
                border: "1px solid rgba(59,130,246,0.3)",
              }}>
                ⚡ BitCode {c.bitcodeScore > 0 ? `${c.bitcodeScore} pts` : "user"}
              </span>
            )}

            {/* Match score */}
            <span style={{
              fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: c.matchScore >= 70 ? "rgba(16,185,129,0.15)" : c.matchScore >= 40 ? "rgba(245,158,11,0.15)" : "rgba(148,163,184,0.1)",
              color: c.matchScore >= 70 ? "var(--green)" : c.matchScore >= 40 ? "var(--yellow)" : "var(--text-3)",
              border: `1px solid ${c.matchScore >= 70 ? "rgba(16,185,129,0.3)" : c.matchScore >= 40 ? "rgba(245,158,11,0.3)" : "var(--border)"}`,
              marginLeft: "auto",
            }}>
              {c.matchScore}% match
            </span>
          </div>

          {c.githubBio && (
            <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>{c.githubBio}</div>
          )}

          {/* GitHub stats */}
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
            <span>👥 {c.followers.toLocaleString()} followers</span>
            <span>📁 {c.publicRepos} repos</span>
          </div>

          {/* Verified Usage (own repos) */}
          {evidence.length > 0 && (
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Verified usage in their repos
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {evidence.slice(0, 3).map((hit) => (
                  <div key={hit.repo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <a href={hit.repoUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: "var(--green)", textDecoration: "none", fontWeight: 600 }}>
                      {hit.repo}
                    </a>
                    <span style={{ color: "var(--text-3)" }}>{hit.file}</span>
                    <span style={{ color: "var(--text-2)" }}>
                      {hit.packagesFound.slice(0, 3).join(", ")}
                      {hit.packagesFound.length > 3 ? ` +${hit.packagesFound.length - 3}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched repos (ecosystem contributions) */}
          {repos.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
                Contributed to
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {repos.slice(0, 4).map((r: any) => (
                  <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 6,
                      background: "rgba(148,163,184,0.08)", color: "var(--blue)",
                      border: "1px solid var(--border)", textDecoration: "none",
                    }}>
                    {r.name} ⭐{r.stars?.toLocaleString()}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Score breakdown (expandable) */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowScores((v) => !v)}
              style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {showScores ? "Hide" : "Show"} score breakdown
            </button>
            {showScores && (
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "Usage",      value: c.usageScore,      max: 35, color: "#10b981" },
                  { label: "Ecosystem",  value: c.ecosystemScore,  max: 25, color: "#60a5fa" },
                  { label: "Popularity", value: c.popularityScore, max: 10, color: "#f59e0b" },
                  { label: "BitCode",    value: c.bitcodeScore > 30 ? 30 : c.bitcodeScore, max: 30, color: "#a78bfa" },
                ].map((s) => (
                  <div key={s.label} style={{ fontSize: 11, textAlign: "center", minWidth: 60 }}>
                    <div style={{ fontWeight: 700, color: s.color }}>{s.value}/{s.max}</div>
                    <div style={{ color: "var(--text-3)", marginTop: 2 }}>{s.label}</div>
                    <div style={{
                      height: 3, borderRadius: 2, marginTop: 3,
                      background: `linear-gradient(90deg, ${s.color} ${(s.value / s.max) * 100}%, var(--border) ${(s.value / s.max) * 100}%)`,
                      width: 60,
                    }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* HR notes */}
          {c.hrNotes && !showNotes && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-2)", fontStyle: "italic" }}>
              📝 {c.hrNotes}
            </div>
          )}
          {showNotes && (
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <input className="input" style={{ flex: 1, fontSize: 13 }} placeholder="Internal notes…"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="btn sm" onClick={saveNotes} disabled={saving}>Save</button>
              <button className="btn sm secondary" onClick={() => setShowNotes(false)}>Cancel</button>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            {/* Status selector */}
            {(["NEW", "VIEWED", "SHORTLISTED", "CONTACTED", "REJECTED"] as CandidateStatus[]).map((s) => {
              const m = CANDIDATE_STATUS_META[s];
              return (
                <button key={s}
                  className={`btn sm ${c.status === s ? "" : "secondary"}`}
                  style={{ fontSize: 11, color: c.status === s ? undefined : m.color,
                    borderColor: c.status === s ? undefined : m.color + "55" }}
                  onClick={() => updateStatus(s)} disabled={saving}>
                  {m.label}
                </button>
              );
            })}
            <button className="btn sm secondary" style={{ marginLeft: 4, fontSize: 11 }}
              onClick={() => setShowNotes((v) => !v)}>
              📝 Note
            </button>
            <a href={`https://github.com/${c.githubLogin}`} target="_blank" rel="noopener noreferrer"
              className="btn sm secondary" style={{ fontSize: 11, textDecoration: "none" }}>
              GitHub ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Job detail / HR view ─────────────────────────────────────────────────────

function JobDetail({ jobId, currentUserId }: { jobId: string; currentUserId?: string }) {
  const [job, setJob]             = useState<(Job & { candidates?: Candidate[] }) | null>(null);
  const [loading, setLoading]     = useState(true);
  const [discovering, setDiscover] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<any>(null);
  const [err, setErr]             = useState<string | null>(null);
  const [candidateFilter, setCandidateFilter] = useState<CandidateStatus | "ALL">("ALL");

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((j) => setJob(j.job))
      .catch((e) => setErr(String(e.message)))
      .finally(() => setLoading(false));
  }, [jobId]);

  async function discover() {
    setDiscover(true); setDiscoverResult(null); setErr(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/discover`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Discovery failed");
      setDiscoverResult(j);
      // Reload candidates
      const j2 = await fetch(`/api/jobs/${jobId}`).then((r) => r.json());
      setJob(j2.job);
    } catch (e) { setErr((e as Error).message); }
    setDiscover(false);
  }

  function updateCandidate(updated: Candidate) {
    setJob((prev) => prev ? {
      ...prev,
      candidates: prev.candidates?.map((c) => c.id === updated.id ? updated : c),
    } : prev);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>;
  if (!job) return <div style={{ color: "var(--red)" }}>Job not found</div>;

  const isOwner = currentUserId === job.postedBy?.id;
  const salary  = salaryLabel(job.salaryMin, job.salaryMax, job.currency);
  const candidates = job.candidates ?? [];
  const filtered   = candidateFilter === "ALL" ? candidates : candidates.filter((c) => c.status === candidateFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Job header */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {job.logoUrl && (
            <img src={job.logoUrl} alt={job.company}
              style={{ width: 56, height: 56, borderRadius: 12, border: "1px solid var(--border)", objectFit: "contain" }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{job.title}</div>
            <div style={{ color: "var(--text-2)", marginTop: 2, fontSize: 15 }}>{job.company}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", fontSize: 13, color: "var(--text-3)" }}>
              <span>{JOB_TYPE_LABEL[job.jobType]}</span>
              {job.location && <span>📍 {job.location}</span>}
              {job.remote && <span>🌐 Remote</span>}
              {salary && <span style={{ color: "var(--green)", fontWeight: 600 }}>💰 {salary}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {job.tags.map((t) => (
                <span key={t} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 6,
                  background: "rgba(59,130,246,0.1)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.25)",
                }}>{t}</span>
              ))}
            </div>
          </div>
          {job.applyUrl && (
            <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="btn sm">
              Apply ↗
            </a>
          )}
        </div>
        <div style={{ marginTop: 16, fontSize: 14, color: "var(--text-2)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {job.description}
        </div>
      </div>

      {/* HR candidate discovery panel */}
      {isOwner && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              Matched Candidates
              {candidates.length > 0 && (
                <span style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)", marginLeft: 8 }}>
                  {candidates.length} found
                </span>
              )}
            </div>
            <button className="btn sm" onClick={discover} disabled={discovering} style={{ marginLeft: "auto" }}>
              {discovering ? "Searching GitHub…" : candidates.length > 0 ? "🔄 Re-discover" : "🔍 Discover Candidates"}
            </button>
          </div>

          {discoverResult && (
            <div style={{ fontSize: 13, color: "var(--text-2)", padding: "10px 14px", background: "var(--green-dim)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.25)" }}>
              ✅ Searched {discoverResult.reposSearched} repos, found {discoverResult.candidatesFound} contributors.
              {discoverResult.repos?.length > 0 && (
                <span> Repos: {discoverResult.repos.map((r: any) => r.name).join(", ")}</span>
              )}
            </div>
          )}

          {err && <div style={{ color: "var(--red)", fontSize: 13 }}>{err}</div>}

          {candidates.length > 0 && (
            <>
              {/* Candidate filter */}
              <div style={{ display: "flex", gap: 8 }}>
                {(["ALL", "NEW", "VIEWED", "SHORTLISTED", "CONTACTED", "REJECTED"] as const).map((s) => (
                  <button key={s}
                    className={`btn sm ${candidateFilter === s ? "" : "secondary"}`}
                    onClick={() => setCandidateFilter(s)}
                    style={{ fontSize: 11 }}>
                    {s === "ALL" ? `All (${candidates.length})` : `${CANDIDATE_STATUS_META[s].label} (${candidates.filter((c) => c.status === s).length})`}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map((c) => (
                  <CandidateCard key={c.id} c={c} jobId={job.id} onUpdate={updateCandidate} />
                ))}
                {filtered.length === 0 && (
                  <div style={{ padding: 30, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                    No candidates with this status.
                  </div>
                )}
              </div>
            </>
          )}

          {!discovering && candidates.length === 0 && !discoverResult && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
              Click "Discover Candidates" to search GitHub for contributors who match your skill tags.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Job board (browse) ───────────────────────────────────────────────────────

function JobBoard() {
  const [jobs, setJobs]       = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs").then((r) => r.json())
      .then((j) => setJobs(j.jobs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? jobs.filter((j) =>
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        j.company.toLowerCase().includes(search.toLowerCase()) ||
        j.tags.some((t) => t.includes(search.toLowerCase()))
      )
    : jobs;

  if (selected) {
    return (
      <div>
        <button className="btn sm secondary" onClick={() => setSelected(null)} style={{ marginBottom: 16 }}>
          ← Back to jobs
        </button>
        <JobDetail jobId={selected} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input className="input" placeholder="Search jobs, companies, skills…"
        style={{ maxWidth: 340 }} value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading jobs…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>No open jobs yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((j) => {
            const salary = salaryLabel(j.salaryMin, j.salaryMax, j.currency);
            return (
              <div key={j.id} className="card card-hover" style={{ padding: 18, cursor: "pointer" }}
                onClick={() => setSelected(j.id)}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, background: "rgba(148,163,184,0.08)",
                    border: "1px solid var(--border)", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 18, flexShrink: 0,
                  }}>
                    {j.logoUrl
                      ? <img src={j.logoUrl} alt={j.company} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }} />
                      : j.company.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{j.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{j.company}</div>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 12, color: "var(--text-3)", flexWrap: "wrap" }}>
                      <span>{JOB_TYPE_LABEL[j.jobType]}</span>
                      {j.remote && <span>🌐 Remote</span>}
                      {j.location && <span>📍 {j.location}</span>}
                      {salary && <span style={{ color: "var(--green)", fontWeight: 600 }}>{salary}</span>}
                      <span style={{ marginLeft: "auto" }}>{timeAgo(j.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {j.tags.slice(0, 5).map((t) => (
                        <span key={t} style={{
                          fontSize: 11, padding: "1px 7px", borderRadius: 6,
                          background: "rgba(59,130,246,0.1)", color: "var(--blue)", border: "1px solid rgba(59,130,246,0.2)",
                        }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Jobs component (tabbed) ─────────────────────────────────────────────

export function Jobs({ currentUserId }: { currentUserId?: string }) {
  const [tab, setTab]      = useState<"browse" | "post" | "mine">("browse");
  const [postedJob, setPostedJob] = useState<Job | null>(null);

  // After posting, switch to job detail view
  if (postedJob) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="btn sm secondary" onClick={() => setPostedJob(null)}>← Back</button>
          <div style={{ color: "var(--green)", fontSize: 14, fontWeight: 600 }}>
            ✅ Job posted! Now finding candidates…
          </div>
        </div>
        <JobDetail jobId={postedJob.id} currentUserId={currentUserId} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {([
          { key: "browse", label: "💼 Browse Jobs" },
          { key: "post",   label: "➕ Post a Job" },
          { key: "mine",   label: "📋 My Postings" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            background: "none", border: "none", padding: "8px 18px", cursor: "pointer",
            fontSize: 14, fontWeight: tab === key ? 700 : 500,
            color: tab === key ? "var(--blue)" : "var(--text-2)",
            borderBottom: `2px solid ${tab === key ? "var(--blue)" : "transparent"}`,
            marginBottom: -1, transition: "color 0.15s",
          }}>{label}</button>
        ))}
      </div>

      {tab === "browse" && <JobBoard />}
      {tab === "post"   && (
        currentUserId
          ? <PostJobForm onPosted={(job) => { setPostedJob(job); }} />
          : <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Sign in to post a job.</div>
      )}
      {tab === "mine"   && (
        currentUserId
          ? <MyPostings currentUserId={currentUserId} />
          : <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Sign in to see your postings.</div>
      )}
    </div>
  );
}

// ─── My Postings ──────────────────────────────────────────────────────────────

function MyPostings({ currentUserId }: { currentUserId: string }) {
  const [jobs, setJobs]     = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs?mine=1").then((r) => r.json())
      .then((j) => setJobs(j.jobs ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (selected) {
    return (
      <div>
        <button className="btn sm secondary" onClick={() => setSelected(null)} style={{ marginBottom: 16 }}>
          ← My postings
        </button>
        <JobDetail jobId={selected} currentUserId={currentUserId} />
      </div>
    );
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>Loading…</div>;
  if (!jobs.length) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--text-3)" }}>
      You haven't posted any jobs yet.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {jobs.map((j) => (
        <div key={j.id} className="card card-hover" style={{ padding: 16, cursor: "pointer" }}
          onClick={() => setSelected(j.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{j.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{j.company} · {timeAgo(j.createdAt)}</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                {j._count?.candidates ?? 0} candidates
              </span>
              <span className={`badge ${j.status === "OPEN" ? "green" : "gray"}`}>{j.status}</span>
              <span style={{ fontSize: 13, color: "var(--blue)" }}>View →</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
