import { Leaderboard } from "../../../components/Leaderboard";

export default function Page() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Leaderboard</div>
        <div style={{ color: "var(--text-2)", marginTop: 4 }}>
          Top evaluated attempts, reputation leaders, and biggest earners.
        </div>
      </div>
      <Leaderboard />
    </div>
  );
}
