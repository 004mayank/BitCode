"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "./api";

export function BountyDetails({ bountyId }: { bountyId: string }) {
  const [bounty, setBounty] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState({ repoUrl: "", prUrl: "", commitSha: "", note: "" });
  const [review, setReview] = useState<{ submissionId: string; comment: string; scoreTotal: number; isPublic: boolean }>(
    { submissionId: "", comment: "", scoreTotal: 80, isPublic: false }
  );

  async function load() {
    const j = await apiGet<any>(`/api/bounties/${bountyId}`);
    setBounty(j.bounty);
  }

  useEffect(() => {
    load().catch((e) => setErr(String(e?.message || e)));
  }, [bountyId]);

  async function submit() {
    setErr(null);
    await apiPost(`/api/bounties/${bountyId}/submissions`, {
      repoUrl: sub.repoUrl,
      prUrl: sub.prUrl || undefined,
      commitSha: sub.commitSha || undefined,
      note: sub.note || undefined
    });
    setSub({ repoUrl: "", prUrl: "", commitSha: "", note: "" });
    await load();
  }

  async function leaveReview() {
    setErr(null);
    await apiPost(`/api/submissions/${review.submissionId}/reviews`, {
      comment: review.comment,
      scoreTotal: review.scoreTotal,
      isPublic: review.isPublic
    });
    setReview((r) => ({ ...r, comment: "" }));
    await load();
  }

  if (err) return <div style={{ color: "#fca5a5" }}>{err}</div>;
  if (!bounty) return <div style={{ color: "#64748b" }}>Loading…</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 14 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{bounty.title}</div>
        <div style={{ color: "#94a3b8", marginTop: 6 }}>{bounty.description}</div>
        <div style={{ color: "#64748b", marginTop: 8, fontSize: 13 }}>
          Status: {bounty.status} · Reward: {bounty.rewardPts} pts
        </div>

        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ fontWeight: 800 }}>Submit</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <input className="input" placeholder="Repo URL" value={sub.repoUrl} onChange={(e) => setSub((s) => ({ ...s, repoUrl: e.target.value }))} />
            <input className="input" placeholder="PR URL (optional)" value={sub.prUrl} onChange={(e) => setSub((s) => ({ ...s, prUrl: e.target.value }))} />
            <input className="input" placeholder="Commit SHA (optional)" value={sub.commitSha} onChange={(e) => setSub((s) => ({ ...s, commitSha: e.target.value }))} />
            <textarea className="textarea" rows={3} placeholder="Note (optional)" value={sub.note} onChange={(e) => setSub((s) => ({ ...s, note: e.target.value }))} />
            <button className="btn" onClick={submit} disabled={!sub.repoUrl}>
              Submit to bounty
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Submissions</div>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {(bounty.submissions || []).map((s: any) => (
            <div key={s.id} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>{s.user?.name || s.user?.github || s.userId}</div>
                <div style={{ color: "#93c5fd", fontWeight: 900 }}>{s.status}</div>
              </div>
              <div style={{ color: "#94a3b8", marginTop: 6, wordBreak: "break-word" }}>{s.repoUrl}</div>
              {s.prUrl ? <div style={{ color: "#64748b", marginTop: 4, wordBreak: "break-word" }}>{s.prUrl}</div> : null}
              {s.note ? <div style={{ color: "#94a3b8", marginTop: 6 }}>{s.note}</div> : null}
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  className="btn secondary"
                  onClick={() => setReview((r) => ({ ...r, submissionId: s.id }))}
                >
                  Review
                </button>
              </div>
            </div>
          ))}
          {!bounty.submissions?.length ? <div style={{ color: "#64748b" }}>No submissions yet.</div> : null}
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(148,163,184,.18)" }}>
          <div style={{ fontWeight: 900 }}>Manual review (scope B: simple)</div>
          <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
            Pick a submission → leave a comment + optional score.
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <input
              className="input"
              placeholder="Submission ID"
              value={review.submissionId}
              onChange={(e) => setReview((r) => ({ ...r, submissionId: e.target.value }))}
            />
            <input
              className="input"
              type="number"
              value={review.scoreTotal}
              onChange={(e) => setReview((r) => ({ ...r, scoreTotal: Number(e.target.value) }))}
            />
            <textarea
              className="textarea"
              rows={3}
              placeholder="Comment"
              value={review.comment}
              onChange={(e) => setReview((r) => ({ ...r, comment: e.target.value }))}
            />
            <label style={{ display: "flex", gap: 10, alignItems: "center", color: "#94a3b8", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={review.isPublic}
                onChange={(e) => setReview((r) => ({ ...r, isPublic: e.target.checked }))}
              />
              Public
            </label>
            <button className="btn" onClick={leaveReview} disabled={!review.submissionId || !review.comment.trim()}>
              Submit review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

