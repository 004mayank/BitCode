import { auth, signIn } from "../../auth";

async function githubSignIn() {
  "use server";
  await signIn("github", { redirectTo: "/dashboard" });
}
async function googleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

function GithubIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default async function AuthPage() {
  const session = await auth();
  const user = (session as any)?.user;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#000",
      padding: "24px 16px",
      fontFamily: "ui-sans-serif,system-ui,-apple-system,sans-serif",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background glows */}
      <div style={{ position: "absolute", top: "20%", left: "30%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "15%", right: "25%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 28, alignItems: "center", position: "relative" }}>

        {/* Logo */}
        <a href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-0.03em" }}>
            <span style={{ color: "#fff" }}>Bit</span>
            <span style={{ color: "#8b5cf6" }}>Code</span>
          </span>
        </a>

        {user ? (
          /* ── Already signed in ── */
          <div style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 32, textAlign: "center" }}>
            {user.image && (
              <img src={user.image} alt="" style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", margin: "0 auto 16px", display: "block" }} />
            )}
            <div style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>{user.name || user.email}</div>
            {user.email && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 4 }}>{user.email}</div>}

            <div style={{ margin: "20px 0", padding: "10px 16px", borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <div style={{ color: "#10b981", fontWeight: 600, fontSize: 13 }}>Signed in successfully</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href="/dashboard" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "#3b82f6", color: "#fff", padding: "11px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                Go to Dashboard →
              </a>
              <a href="/challenges" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", padding: "11px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)" }}>
                Browse Challenges
              </a>
              <a href="/api/auth/signout" style={{ display: "flex", justifyContent: "center", alignItems: "center", color: "rgba(255,255,255,0.3)", padding: "11px 20px", borderRadius: 10, fontSize: 13, textDecoration: "none" }}>
                Sign out
              </a>
            </div>
          </div>

        ) : (
          /* ── Sign in card ── */
          <div style={{ width: "100%", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "36px 32px" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 10, letterSpacing: "-0.02em" }}>
                Welcome to BitCode
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.65 }}>
                The platform that scores <em style={{ color: "rgba(255,255,255,0.65)", fontStyle: "normal", fontWeight: 600 }}>how</em> you use AI, not just what you build.
              </div>
            </div>

            {/* Benefits */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
              {[
                ["⚡", "Solve 151 real-world engineering challenges"],
                ["◎", "Get an AI Skill Score across 4 dimensions"],
                ["💰", "Compete for bounties from real organizations"],
                ["🔥", "Build a contribution streak and dev resume"],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            {/* Sign-in buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <form action={githubSignIn} style={{ width: "100%" }}>
                <button type="submit" style={{
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 10,
                  width: "100%", background: "#fff", color: "#000",
                  padding: "13px 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", border: "none",
                }}>
                  <GithubIcon /> Continue with GitHub
                </button>
              </form>
              <form action={googleSignIn} style={{ width: "100%" }}>
                <button type="submit" style={{
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 10,
                  width: "100%", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.85)",
                  padding: "13px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  <GoogleIcon /> Continue with Google
                </button>
              </form>
            </div>

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.2)", lineHeight: 1.6 }}>
              By signing in you agree to our terms.<br />Your public profile is used to create your developer identity.
            </div>
          </div>
        )}

        {/* Back to home */}
        <a href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.2)", textDecoration: "none" }}>
          ← Back to home
        </a>
      </div>
    </div>
  );
}
