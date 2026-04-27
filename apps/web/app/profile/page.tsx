import { Profile } from "../../components/Profile";

export default function Page() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Your Profile</div>
        <div style={{ color: "var(--text-2)", marginTop: 4 }}>
          Your AI Skill Score, reputation, and developer resume.
        </div>
      </div>
      <Profile />
    </div>
  );
}
