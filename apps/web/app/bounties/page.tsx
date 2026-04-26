import { Bounties } from "../../components/Bounties";

export default function Page() {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 800 }}>Bounties</div>
      <div style={{ color: "#94a3b8", marginTop: 6 }}>Points-only MVP (no Stripe yet).</div>
      <div style={{ marginTop: 14 }}>
        <Bounties />
      </div>
    </div>
  );
}

