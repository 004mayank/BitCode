import { auth } from "../../../auth";
import { Jobs } from "../../../components/Jobs";

export default async function JobsPage() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Jobs</div>
        <div style={{ color: "var(--text-2)", marginTop: 4 }}>
          Find AI/ML roles, or post a job and let us find you matching open-source talent from GitHub.
        </div>
      </div>
      <Jobs currentUserId={userId} />
    </div>
  );
}
