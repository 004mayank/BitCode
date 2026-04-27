import { Bounties } from "../../components/Bounties";

export default function Page() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Bounties</div>
        <div style={{ color: "var(--text-2)", marginTop: 4 }}>
          Compete on open challenges. Earn points. Build your AI developer profile.
        </div>
      </div>
      <Bounties />
    </div>
  );
}
