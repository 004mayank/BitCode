"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";
import { ContributionGraph } from "./ContributionGraph";

type Stats = {
  reputationPts: number;
  bountyEarnedPts: number;
  bountiesWon: number;
  submissionsCount: number;
  avgSubmissionScore: number;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
};

type User = {
  id: string;
  name?: string | null;
  email?: string | null;
  github?: string | null;
  image?: string | null;
};

function scoreColor(n: number) {
  if (n >= 75) return "var(--green)";
  if (n >= 50) return "var(--yellow)";
  return "var(--red)";
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  const color = scoreColor(value);
  const r = 38, circ = 2 * Math.PI * r, filled = (value / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap="round" transform="rotate(-90 48 48)" />
        <text x={48} y={53} textAnchor="middle" fill={color} fontSize={18} fontWeight={800}>{value}</text>
      </svg>
      <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Avatar({ user }: { user: User }) {
  if (user.image) {
    return <img src={user.image} alt="" style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid var(--border)" }} />;
  }
  const name = user.name || user.github || "?";
  const initials = name.slice(0, 2).toUpperCase();
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{ width: 72, height: 72, borderRadius: "50%", background: `hsl(${hue},55%,35%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", border: "3px solid var(--border)", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Profile() {
  const [data, setData]         = useState<{ user: User; stats: Stats | null } | null>(null);
  const [activity, setActivity] = useState<Record<string, number>>({});
  const [err, setErr]           = useState<string | null>(null);

  useEffect(() => {
    apiGet<any>("/api/me")
      .then(setData)
      .catch((e) => setErr(String(e?.message || e)));

    apiGet<{ ok: true; activity: Record<string, number> }>("/api/me/activity")
      .then((j) => setActivity(j.activity))
      .catch(() => {});
  }, []);

  if (err) {
    return (
      <div className="card" style={{ padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Not signed in</div>
        <div style={{ color: "var(--text-2)", marginBottom: 16, fontSize: 13 }}>
          Sign in with GitHub to see your profile, AI Skill Score, and contribution streak.
        </div>
        <a href="/auth" className="btn" style={{ display: "inline-flex" }}>Sign in with GitHub</a>
      </div>
    );
  }

  if (!data) {
    return <div style={{ color: "var(--text-3)", textAlign: "center", padding: 40 }}>Loading…</div>;
  }

  const { user, stats: s } = data;
  const displayName = user.name || (user.github ? `@${user.github}` : user.email) || "Anonymous";
  const aiScore = s
    ? Math.min(100, Math.round((s.avgSubmissionScore * 0.4) + (Math.min(s.reputationPts, 500) / 500) * 60))
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, #0d1527 0%, #111c35 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <Avatar user={user} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{displayName}</div>
            <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {user.github && <span>@{user.github}</span>}
              {user.email  && <span>{user.email}</span>}
              {s?.lastActiveDate && <span style={{ color: "var(--text-3)" }}>Last active {s.lastActiveDate}</span>}
            </div>
            {s && (s.currentStreak > 0 || s.longestStreak > 0) && (
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {s.currentStreak > 0 && (
                  <span style={{ fontSize: 12, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "2px 10px", borderRadius: 999, border: "1px solid rgba(249,115,22,0.25)", fontWeight: 700 }}>
                    🔥 {s.currentStreak} day streak
                  </span>
                )}
                {s.longestStreak > 0 && (
                  <span style={{ fontSize: 12, color: "var(--purple)", background: "var(--purple-dim)", padding: "2px 10px", borderRadius: 999, border: "1px solid rgba(139,92,246,0.25)", fontWeight: 700 }}>
                    ⚡ {s.longestStreak} day best
                  </span>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {user.github && (
                <a href={`https://github.com/${user.github}`} target="_blank" rel="noopener noreferrer" className="btn secondary sm">
                  GitHub ↗
                </a>
              )}
              <a href="/challenges" className="btn sm">Start a Challenge</a>
            </div>
          </div>
          {s && <ScoreRing value={aiScore} label="AI Skill Score" />}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard label="Reputation"   value={s?.reputationPts ?? 0}      color="var(--blue)" />
        <StatCard label="Pts Earned"   value={s?.bountyEarnedPts ?? 0}    color="var(--green)"  sub="from bounties" />
        <StatCard label="Bounties Won" value={s?.bountiesWon ?? 0}        color="var(--purple)" />
        <StatCard label="Submissions"  value={s?.submissionsCount ?? 0}   color="var(--text-1)" />
        <StatCard label="Avg Score"    value={s?.avgSubmissionScore ?? 0} color={scoreColor(s?.avgSubmissionScore ?? 0)} sub="submissions" />
      </div>

      {/* Contribution graph */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Contribution Activity</div>
        <ContributionGraph
          activity={activity}
          currentStreak={s?.currentStreak ?? 0}
          longestStreak={s?.longestStreak ?? 0}
          totalActiveDays={s?.totalActiveDays ?? 0}
        />
      </div>

      {/* Score breakdown */}
      {s ? (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>AI Skill Score Breakdown</div>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap" }}>
            <ScoreRing value={Math.min(100, s.avgSubmissionScore)}                            label="Submission Avg" />
            <ScoreRing value={Math.min(100, Math.round(Math.min(s.reputationPts, 500) / 5))} label="Reputation" />
            <ScoreRing value={Math.min(100, s.bountiesWon * 20)}                             label="Wins" />
          </div>
          <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
              Your AI Skill Score combines submission quality, reputation, and bounties won.
              Every challenge you work on — even without submitting — counts toward your streak.
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>No stats yet</div>
          <div style={{ color: "var(--text-2)", marginBottom: 16, fontSize: 13 }}>
            Complete a challenge or submit a bounty to build your profile.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <a href="/challenges" className="btn">Browse Challenges</a>
            <a href="/bounties" className="btn secondary">View Bounties</a>
          </div>
        </div>
      )}
    </div>
  );
}
