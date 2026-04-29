import { ChallengesList } from "../../../components/ChallengesList";
import { DashboardHero } from "../../../components/DashboardHero";

export default function DashboardPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <DashboardHero />
      <ChallengesList />
    </div>
  );
}
