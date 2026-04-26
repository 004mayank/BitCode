import { Leaderboard } from "../../components/Leaderboard";

export default function Page() {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>Leaderboard</div>
      <div style={{ color: "#94a3b8", marginTop: 6 }}>Top evaluated attempts (MVP).</div>
      <div style={{ marginTop: 14 }}>
        <Leaderboard />
      </div>
    </div>
  );
}

