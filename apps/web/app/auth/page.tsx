import { auth } from "../api/auth/[...nextauth]/route";
import Image from "next/image";

export default async function Page() {
  const session = await auth();
  const user = (session as any)?.user;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: "24px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>

        {/* Logo */}
        <a href="/" style={{ textDecoration: "none" }}>
          <Image
            src="/bitcode-dark.svg"
            alt="BitCode"
            width={180}
            height={60}
            style={{ height: 48, width: "auto" }}
            priority
          />
        </a>

        {user ? (
          /* ── Already signed in ── */
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 0 }}>
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              {user.image && (
                <img
                  src={user.image}
                  alt=""
                  style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid var(--border)", margin: "0 auto 16px" }}
                />
              )}
              <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name || user.email}</div>
              {user.email && <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 4 }}>{user.email}</div>}

              <div style={{ margin: "20px 0", padding: "10px 16px", borderRadius: 10, background: "var(--green-dim)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <div style={{ color: "var(--green)", fontWeight: 600, fontSize: 13 }}>✓ Signed in successfully</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href="/profile" className="btn" style={{ justifyContent: "center" }}>Go to Profile →</a>
                <a href="/challenges" className="btn secondary" style={{ justifyContent: "center" }}>Browse Challenges</a>
                <a href="/api/auth/signout" className="btn ghost" style={{ justifyContent: "center" }}>Sign out</a>
              </div>
            </div>
          </div>
        ) : (
          /* ── Sign in card ── */
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 0 }}>
            <div className="card" style={{ padding: 32 }}>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Welcome to BitCode</div>
                <div style={{ color: "var(--text-2)", fontSize: 14, lineHeight: 1.6 }}>
                  The platform that scores <em>how</em> you use AI,<br />not just what you build.
                </div>
              </div>

              {/* Benefits */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {[
                  ["🏆", "Build a verifiable AI Skill Score"],
                  ["📋", "Track your full AI workflow across challenges"],
                  ["💰", "Compete for bounties posted by real companies"],
                  ["🔥", "Grow a contribution streak like your GitHub graph"],
                ].map(([icon, text]) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--text-2)" }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <a
                href="/api/auth/signin/github"
                className="btn"
                style={{ display: "flex", justifyContent: "center", gap: 10, width: "100%", padding: "12px 20px", fontSize: 15 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </a>

              <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
                By signing in you agree to our terms. Your GitHub username and public profile are used to create your developer identity.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
