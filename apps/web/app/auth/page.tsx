import { auth } from "../api/auth/[...nextauth]/route";

export default async function Page() {
  const session = await auth();

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>Auth</div>
      <div style={{ color: "#94a3b8", marginTop: 6 }}>
        GitHub OAuth via NextAuth (Prisma adapter).
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
        <div style={{ fontWeight: 800 }}>Session</div>
        <pre style={{ marginTop: 10, fontSize: 12, color: "#cbd5e1", overflowX: "auto" }}>
{JSON.stringify(session, null, 2)}
        </pre>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <a className="btn" href="/api/auth/signin">
          Sign in
        </a>
        <a className="btn secondary" href="/api/auth/signout">
          Sign out
        </a>
      </div>
    </div>
  );
}

