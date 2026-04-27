import { auth } from "../api/auth/[...nextauth]/route";

export default async function Page() {
  const session = await auth();
  const user = (session as any)?.user;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Sign In</div>
        <div style={{ color: "var(--text-2)", marginTop: 4 }}>
          Connect your GitHub to start solving challenges and building your AI developer profile.
        </div>
      </div>

      {user ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            {user.image && <img src={user.image} alt="" style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid var(--border)" }} />}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name || user.email}</div>
              {user.email && <div style={{ color: "var(--text-2)", fontSize: 13 }}>{user.email}</div>}
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 10, background: "var(--green-dim)", border: "1px solid rgba(16,185,129,0.3)", marginBottom: 20 }}>
            <div style={{ color: "var(--green)", fontWeight: 600, fontSize: 13 }}>✓ Signed in successfully</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/profile" className="btn">View Profile</a>
            <a href="/challenges" className="btn secondary">Browse Challenges</a>
            <a href="/api/auth/signout" className="btn ghost">Sign out</a>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Why GitHub?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                "Track your AI workflow across challenges",
                "Build a public AI Skill Score",
                "Compete for bounties and real opportunities",
              ].map((t) => (
                <div key={t} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--text-2)" }}>
                  <span style={{ color: "var(--green)" }}>✓</span> {t}
                </div>
              ))}
            </div>
          </div>

          <a
            href="/api/auth/signin"
            className="btn"
            style={{ display: "flex", justifyContent: "center", gap: 10 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </a>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              Session state (debug):
            </div>
            <pre style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4, overflowX: "auto" }}>
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
