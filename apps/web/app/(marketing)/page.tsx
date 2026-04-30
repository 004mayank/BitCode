import { BitCodeNavLogo } from "../../components/BitCodeLogo";
import { auth, signIn } from "../../auth";
import Link from "next/link";

/* ── Server actions ────────────────────────────── */
async function signInGitHub() {
  "use server";
  await signIn("github", { redirectTo: "/dashboard" });
}
async function signInGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

/* ── Small reusable pieces ─────────────────────── */
function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

const STATS = [
  { value: "151", label: "Challenges" },
  { value: "4", label: "Skill Dimensions" },
  { value: "12", label: "Languages" },
  { value: "∞", label: "Bounties" },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Real engineering problems",
    body: "151 hand-crafted challenges across backend, frontend, security, AI and more. No toy examples.",
    color: "#3b82f6",
  },
  {
    icon: "◎",
    title: "AI Skill Score",
    body: "Evaluated across 4 dimensions: problem decomposition, prompt quality, iteration speed, and output correctness.",
    color: "#8b5cf6",
  },
  {
    icon: "💰",
    title: "Compete for bounties",
    body: "Organizations post real bounties. Win them. Earn points. Build a verifiable developer identity.",
    color: "#10b981",
  },
  {
    icon: "🔥",
    title: "Contribution streak",
    body: "Every challenge you attempt counts. Grow a GitHub-style streak that signals consistency to employers.",
    color: "#f59e0b",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Pick a challenge",
    body: "Browse 151 real-world engineering problems filtered by language, difficulty, and domain.",
  },
  {
    n: "02",
    title: "Solve with AI tools",
    body: "Use any AI assistant you choose. Write code in 12 languages directly in the browser.",
  },
  {
    n: "03",
    title: "Get your AI Skill Score",
    body: "Submit your solution. Our evaluator reads your workflow and scores how you think, not just what you ship.",
  },
];

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div style={{ background: "#000", color: "#f0f4f8", fontFamily: "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", overflowX: "hidden" }}>

      {/* ══ NAV ════════════════════════════════════════════════════════════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        background: "rgba(0,0,0,0.72)",
      }}>
        <div style={{ padding: "0 6vw", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo — extreme left */}
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <BitCodeNavLogo cellSize={2} textSize={20} gap={12} />
          </Link>

          {/* Nav links — center */}
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[
              { href: "/dashboard", label: "Dashboard" },
              { href: "/challenges", label: "Challenges" },
              { href: "/bounties", label: "Bounties" },
              { href: "/leaderboard", label: "Leaderboard" },
              { href: "/about", label: "About" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="lp-nav-link">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Auth CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isLoggedIn ? (
              <Link href="/dashboard" style={{
                background: "#3b82f6", color: "#fff", padding: "8px 20px",
                borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}>
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/auth" style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textDecoration: "none", padding: "8px 14px" }}>
                  Sign in
                </Link>
                <Link href="/auth" style={{
                  background: "#3b82f6", color: "#fff", padding: "8px 20px",
                  borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                  boxShadow: "0 0 20px rgba(59,130,246,0.4)",
                }}>
                  Get started →
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ══ HERO ═══════════════════════════════════════════════════════════════ */}
      <section style={{
        minHeight: "100vh", paddingTop: 60, display: "flex", alignItems: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background glow blobs */}
        <div style={{ position: "absolute", top: "10%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "5%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "30%", right: "20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,220,180,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ padding: "80px 6vw", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(44px, 6vw, 80px)", fontWeight: 900, lineHeight: 1.05,
            letterSpacing: "-0.03em", margin: "0 0 20px", maxWidth: 800,
            background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.75) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            The development<br />cycle is changing.
          </h1>

          {/* Sub-headline */}
          <p style={{
            fontSize: "clamp(18px, 2vw, 24px)", fontWeight: 400, lineHeight: 1.5,
            color: "rgba(255,255,255,0.55)", margin: "0 0 14px",
          }}>
            So are the tools.
          </p>

          {/* Body */}
          <p style={{
            fontSize: 16, lineHeight: 1.75, color: "rgba(255,255,255,0.45)",
            maxWidth: 560, margin: "0 0 44px",
          }}>
            BitCode integrates the latest AI coding technology and evaluates developers on{" "}
            <em style={{ color: "rgba(255,255,255,0.7)", fontStyle: "normal", fontWeight: 600 }}>how they think,</em>
            {" "}not just what they ship. Solve real engineering problems, log your AI workflow, get an explainable skill score.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 64 }}>
            {isLoggedIn ? (
              <Link href="/dashboard" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#3b82f6", color: "#fff", padding: "14px 28px",
                borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 0 32px rgba(59,130,246,0.5), 0 4px 16px rgba(59,130,246,0.3)",
              }}>
                Go to Dashboard →
              </Link>
            ) : (
              <Link href="/auth" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#3b82f6", color: "#fff", padding: "14px 28px",
                borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 0 32px rgba(59,130,246,0.5), 0 4px 16px rgba(59,130,246,0.3)",
              }}>
                Start building →
              </Link>
            )}
            <Link href="/challenges" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)",
              padding: "14px 28px", borderRadius: 10, fontSize: 15, fontWeight: 600,
              textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)",
            }}>
              Browse Challenges
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap", justifyContent: "center" }}>
            {STATS.map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ MARQUEE STRIP ══════════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", padding: "14px 0", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 64, whiteSpace: "nowrap", animation: "marquee 28s linear infinite" }}>
          {Array(3).fill(["Python", "TypeScript", "Go", "Rust", "Java", "C++", "Ruby", "SQL", "Shell", "PHP", "C#", "JavaScript"]).flat().map((lang, i) => (
            <span key={i} style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", fontWeight: 500, fontFamily: "monospace" }}>
              &lt;{lang}/&gt;
            </span>
          ))}
        </div>
      </div>

      {/* ══ FEATURES ═══════════════════════════════════════════════════════════ */}
      <section style={{ padding: "100px 6vw" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8b5cf6", marginBottom: 16 }}>
            Why BitCode
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Built for the AI-first developer
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 16, fontSize: 16, lineHeight: 1.6, maxWidth: 520, margin: "16px auto 0" }}>
            The tools have changed. The way developers are evaluated hasn't. Until now.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, padding: "32px 28px",
              transition: "border-color 0.2s, background 0.2s",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${f.color}18`, border: `1px solid ${f.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, marginBottom: 18,
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", color: "#fff" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ═══════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 6vw 100px", background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 16 }}>
              How it works
            </div>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
              Three steps to your AI Skill Score
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, position: "relative" }}>
            {/* Connector line — from centre of col-1 circle to centre of col-3 circle */}
            <div style={{
              position: "absolute", top: 27, height: 2, zIndex: 0,
              left: "calc(100% / 6)",
              right: "calc(100% / 6)",
              background: "linear-gradient(90deg, rgba(59,130,246,0.5), rgba(139,92,246,0.5), rgba(16,185,129,0.5))",
            }} />
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: i === 0 ? "#3b82f6" : i === 1 ? "#8b5cf6" : "#10b981",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 20,
                  boxShadow: `0 0 20px ${i === 0 ? "rgba(59,130,246,0.4)" : i === 1 ? "rgba(139,92,246,0.4)" : "rgba(16,185,129,0.4)"}`,
                }}>
                  {s.n}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px", color: "#fff" }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: "120px 6vw", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#10b981", marginBottom: 20 }}>
            Get started free
          </div>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 60px)", fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 20px", lineHeight: 1.1 }}>
            Ready to prove your<br />AI skills?
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, margin: "0 0 48px" }}>
            Join developers building a verifiable AI Skill Score. No configuration needed - sign in and start your first challenge in under a minute.
          </p>

          {isLoggedIn ? (
            <Link href="/dashboard" style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: "#3b82f6", color: "#fff", padding: "16px 36px",
              borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 0 40px rgba(59,130,246,0.5)",
            }}>
              Go to Dashboard →
            </Link>
          ) : (
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              <form action={signInGitHub}>
                <button type="submit" style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: "#fff", color: "#000", padding: "15px 32px",
                  borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer",
                  border: "none", boxShadow: "0 4px 24px rgba(255,255,255,0.15)",
                }}>
                  <GithubIcon /> Continue with GitHub
                </button>
              </form>
              <form action={signInGoogle}>
                <button type="submit" style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: "rgba(255,255,255,0.06)", color: "#fff", padding: "15px 32px",
                  borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.12)",
                }}>
                  <GoogleIcon /> Continue with Google
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* ══ FOOTER ═════════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 28px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <BitCodeNavLogo cellSize={2} textSize={18} gap={10} />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
              The AI-native developer platform. &copy; {new Date().getFullYear()}
            </div>
          </div>
          <nav style={{ display: "flex", gap: 24 }}>
            {[
              { href: "/challenges", label: "Challenges" },
              { href: "/bounties", label: "Bounties" },
              { href: "/leaderboard", label: "Leaderboard" },
              { href: "/auth", label: "Sign in" },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>

      {/* ══ KEYFRAMES ══════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-33.33%); }
        }
        .lp-nav-link {
          color: rgba(255,255,255,0.55);
          font-size: 14px;
          font-weight: 500;
          text-decoration: none;
          padding: 6px 14px;
          border-radius: 8px;
          transition: color 0.15s, background 0.15s;
        }
        .lp-nav-link:hover {
          color: #fff;
          background: rgba(255,255,255,0.07);
        }
      `}</style>
    </div>
  );
}
