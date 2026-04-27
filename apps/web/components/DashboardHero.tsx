"use client";

import { useEffect, useState } from "react";
import { apiGet } from "./api";

type Stats = {
  reputationPts: number;
  bountyEarnedPts: number;
  bountiesWon: number;
  submissionsCount: number;
  avgSubmissionScore: number;
};

type Me = { user: any; stats: Stats | null };

export function DashboardHero() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiGet<Me>("/api/me").then(setMe).catch(() => null);
  }, []);

  const s = me?.stats;
  const name = me?.user?.name || me?.user?.github || null;

  return (
    <div>
      {/* Banner */}
      <div
        className="card"
        style={{
          padding: "28px 28px",
          background: "linear-gradient(135deg, #0d1527 0%, #111c35 60%, #131e40 100%)",
          borderColor: "rgba(59,130,246,0.15)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Background glow */}
        <div style={{
          position: "absolute", top: -60, right: -60, width: 240, height: 240,
          background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)",
          pointerEvents: "none"
        }} />
        <div style={{
          position: "absolute", bottom: -40, left: 100, width: 180, height: 180,
          background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)",
          pointerEvents: "none"
        }} />

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
                {name ? `Welcome back, ${name}` : "BitCode"}
              </div>
              <div style={{ color: "var(--text-2)", marginTop: 6, maxWidth: 480, lineHeight: 1.6 }}>
                Pick a real-world challenge. Log your AI workflow. Submit.
                Get an explainable <strong style={{ color: "var(--blue)" }}>AI Skill Score</strong>.
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                <a href="/challenges" className="btn">Browse Challenges</a>
                <a href="/bounties" className="btn secondary">Open Bounties</a>
              </div>
            </div>

            {s ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <StatPill label="Reputation" value={s.reputationPts} color="var(--blue)" />
                <StatPill label="Pts Earned" value={s.bountyEarnedPts} color="var(--green)" />
                <StatPill label="Wins" value={s.bountiesWon} color="var(--purple)" />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Feature tiles */}
      {!me?.stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 4 }}>
          <FeatureTile
            icon="⚡"
            title="AI Challenges"
            desc="Solve real-world problems using AI tools. Get scored on prompt quality and iteration intelligence."
            color="var(--blue)"
          />
          <FeatureTile
            icon="◎"
            title="Bounty System"
            desc="Compete for points on open bounties posted by orgs. Earn reputation and show up on the leaderboard."
            color="var(--green)"
          />
          <FeatureTile
            icon="◉"
            title="Living Resume"
            desc="Your AI Skill Score is a living signal — challenges won, avg score, and workflow quality."
            color="var(--purple)"
          />
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.25)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-sm)",
      padding: "10px 16px",
      textAlign: "center",
      minWidth: 80
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
    </div>
  );
}

function FeatureTile({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 22, marginBottom: 8, color }}>{icon}</div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}
