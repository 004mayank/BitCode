"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "./api";

type Submission = {
  id: string;
  status: string;
  repoUrl: string;
  prUrl?: string | null;
  note?: string | null;
  createdAt: string;
  finalScoreTotal?: number | null;
  autoScoreTotal?: number | null;
  user?: { name?: string | null; github?: string | null };
};

type BountyDetail = {
  id: string;
  title: string;
  description: string;
  status: string;
  rewardPts: number;
  rewardType: string;
  deadline?: string | null;
  requirements?: any;
  challenge?: { title: string; description: string; prompt: string; difficulty: number; tags: string[] } | null;
  org?: { name: string; slug: string } | null;
  submissions: Submission[];
};

function submissionStatusColor(s: string) {
  const map: Record<string, string> = { SUBMITTED: "var(--blue)", SHORTLISTED: "var(--yellow)", WINNER: "var(--green)", REJECTED: "var(--red)", WITHDRAWN: "var(--text-3)" };
  return map[s] ?? "var(--text-3)";
}

function diffDays(deadline: string) {
  const d = new Date(deadline).getTime() - Date.now();
  if (d < 0) return "Deadline passed";
  const days = Math.ceil(d / 86400000);
  return `${days} day${days !== 1 ? "s" : ""} left`;
}

export function BountyDetails({ bountyId }: { bountyId: string }) {
  const [bounty, setBounty] = useState<BountyDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ repoUrl: "", prUrl: "", commitSha: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitOk, setSubmitOk] = useState(false);

  async function load() {
    const j = await apiGet<{ ok: true; bounty: BountyDetail }>(`/api/bounties/${bountyId}`);
    setBounty(j.bounty);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e?.message || e)));
  }, [bountyId]);

  async function submit() {
    if (!form.repoUrl) return;
    setSubmitting(true);
    setErr(null);
    try {
      await apiPost(`/api/bounties/${bountyId}/submissions`, {
        repoUrl: form.repoUrl,
        prUrl: form.prUrl || undefined,
        commitSha: form.commitSha || undefined,
        note: form.note || undefined,
      });
      setSubmitOk(true);
      setForm({ repoUrl: "", prUrl: "", commitSha: "", note: "" });
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!bounty && !err) {
    return <div style={{ color: "var(--text-3)", padding: 40, textAlign: "center" }}>Loading…</div>;
  }
  if (err && !bounty) {
    return <div style={{ color: "var(--red)", padding: 40 }}>{err}</div>;
  }
  if (!bounty) return null;

  const isOpen = bounty.status === "OPEN";
  const bountyStatusColor: Record<string, string> = { OPEN: "var(--green)", DRAFT: "var(--text-3)", SUBMISSIONS_CLOSED: "var(--yellow)", REVIEWING: "var(--yellow)", AWARDED: "var(--purple)", CANCELLED: "var(--red)" };
  const sColor = bountyStatusColor[bounty.status] ?? "var(--text-3)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "flex-start" }}>
      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div className="card" style={{ padding: 24, borderColor: `${sColor}30` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3 }}>{bounty.title}</div>
              {bounty.org && <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>Posted by {bounty.org.name}</div>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: sColor }}>{bounty.rewardPts}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>points</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: sColor, background: `${sColor}18`, border: `1px solid ${sColor}40` }}>
              {bounty.status.replace("_", " ")}
            </span>
            {bounty.deadline && (
              <span style={{ fontSize: 12, color: new Date(bounty.deadline) < new Date() ? "var(--red)" : "var(--yellow)" }}>
                ⏱ {diffDays(bounty.deadline)}
              </span>
            )}
          </div>

          <div style={{ marginTop: 16, color: "var(--text-2)", fontSize: 14, lineHeight: 1.7 }}>{bounty.description}</div>
        </div>

        {/* Challenge */}
        {bounty.challenge && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 10 }}>Challenge</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{bounty.challenge.title}</div>
            <div style={{ color: "var(--text-2)", marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>{bounty.challenge.description}</div>
            <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Problem Statement</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--text-1)", lineHeight: 1.7 }}>{bounty.challenge.prompt}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {bounty.challenge.tags?.map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
          </div>
        )}

        {/* Submissions */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 14 }}>
            Submissions ({bounty.submissions.length})
          </div>
          {bounty.submissions.length === 0 ? (
            <div style={{ color: "var(--text-3)", textAlign: "center", padding: "24px 0" }}>
              No submissions yet. Be the first!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bounty.submissions.map((s) => {
                const name = s.user?.name || (s.user?.github ? `@${s.user.github}` : "Anonymous");
                const sc = s.finalScoreTotal ?? s.autoScoreTotal;
                const isWinner = s.status === "WINNER";
                return (
                  <div key={s.id} style={{ padding: 14, borderRadius: 10, border: "1px solid var(--border)", background: isWinner ? "rgba(16,185,129,0.06)" : "var(--bg)", borderColor: isWinner ? "rgba(16,185,129,0.25)" : "var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: submissionStatusColor(s.status) }}>
                            {isWinner ? "🏆 Winner" : s.status}
                          </span>
                        </div>
                        <a href={s.repoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--blue)", textDecoration: "none", marginTop: 4, display: "block" }}>
                          {s.repoUrl}
                        </a>
                        {s.note && <div style={{ color: "var(--text-2)", fontSize: 12, marginTop: 6 }}>{s.note}</div>}
                      </div>
                      {sc != null && (
                        <div style={{ textAlign: "center", flexShrink: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 20, color: sc >= 75 ? "var(--green)" : sc >= 50 ? "var(--yellow)" : "var(--red)" }}>{sc}</div>
                          <div style={{ fontSize: 10, color: "var(--text-3)" }}>SCORE</div>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>
                      {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar: submit form */}
      <div style={{ position: "sticky", top: 20 }}>
        {isOpen ? (
          <div className="card" style={{ padding: 20, borderColor: "rgba(59,130,246,0.2)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Submit your solution</div>
            <div style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
              Submit your GitHub repo to compete for <strong style={{ color: sColor }}>{bounty.rewardPts} pts</strong>.
            </div>

            {submitOk && (
              <div style={{ padding: 12, borderRadius: 10, background: "var(--green-dim)", border: "1px solid rgba(16,185,129,0.3)", color: "var(--green)", fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                ✓ Submission received!
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4, fontWeight: 600 }}>GitHub repo URL *</div>
                <input className="input" placeholder="https://github.com/you/solution" value={form.repoUrl} onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4, fontWeight: 600 }}>PR URL (optional)</div>
                <input className="input" placeholder="https://github.com/you/repo/pull/1" value={form.prUrl} onChange={(e) => setForm((f) => ({ ...f, prUrl: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4, fontWeight: 600 }}>Commit SHA (optional)</div>
                <input className="input" placeholder="abc1234" value={form.commitSha} onChange={(e) => setForm((f) => ({ ...f, commitSha: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4, fontWeight: 600 }}>Notes</div>
                <textarea className="textarea" rows={3} placeholder="Describe your approach, AI workflow, key decisions…" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
              <button className="btn" disabled={!form.repoUrl || submitting} onClick={submit} style={{ justifyContent: "center" }}>
                {submitting ? "Submitting…" : "Submit Solution"}
              </button>
              {err && <div style={{ color: "var(--red)", fontSize: 13 }}>{err}</div>}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ color: "var(--text-2)", textAlign: "center", padding: "16px 0" }}>
              This bounty is <strong>{bounty.status.replace("_", " ")}</strong> and not accepting new submissions.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
