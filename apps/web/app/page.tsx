import { ChallengesList } from "../components/ChallengesList";

export default function Page() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Dashboard</div>
        <div style={{ color: "#94a3b8", marginTop: 6 }}>
          Pick a real-world challenge. Log your AI workflow. Submit. Get an explainable score.
        </div>
      </div>
      <ChallengesList />
    </div>
  );
}

