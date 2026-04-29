import Link from "next/link";
import { auth } from "../../../auth";

/* ─────────────────────────────────────────────────────────────────────────────
   Data
───────────────────────────────────────────────────────────────────────────── */

const SCORE_DIMENSIONS = [
  {
    key: "Prompt Quality",
    pct: 20,
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.4)",
    icon: "✦",
    bullets: ["Clarity of instructions", "Use of constraints & context", "Ability to guide AI effectively"],
  },
  {
    key: "Iteration Intelligence",
    pct: 20,
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.4)",
    icon: "◈",
    bullets: ["Number of meaningful refinements", "Improvement across iterations", "Ability to learn from prior outputs"],
  },
  {
    key: "Validation & Debugging",
    pct: 25,
    color: "#10b981",
    glow: "rgba(16,185,129,0.4)",
    icon: "⬡",
    bullets: ["Detecting and fixing errors", "Handling edge cases", "Testing and verification"],
  },
  {
    key: "Efficiency",
    pct: 15,
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.4)",
    icon: "⚡",
    bullets: ["Time to working solution", "Effective use of iterations"],
  },
  {
    key: "Output Quality",
    pct: 20,
    color: "#ec4899",
    glow: "rgba(236,72,153,0.4)",
    icon: "◎",
    bullets: ["Correctness of final solution", "Code quality and completeness"],
  },
];

const STEPS = [
  {
    n: "01",
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.35)",
    title: "Pick a real-world challenge",
    body: "Browse problems that simulate real engineering scenarios across backend, frontend, AI, security, and more.",
  },
  {
    n: "02",
    color: "#6366f1",
    glow: "rgba(99,102,241,0.35)",
    title: "Use AI tools to solve it",
    body: "Write prompts, iterate, debug, and refine your solution using any AI assistant you choose.",
  },
  {
    n: "03",
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.35)",
    title: "Your workflow is tracked",
    body: "Prompts, iterations, and validation steps are recorded. The process is the product.",
  },
  {
    n: "04",
    color: "#10b981",
    glow: "rgba(16,185,129,0.35)",
    title: "Get your AI Skill Score",
    body: "Evaluated on 5 dimensions: prompt quality, iteration, validation, efficiency, and output.",
  },
  {
    n: "05",
    color: "#00dc9b",
    glow: "rgba(0,220,155,0.35)",
    title: "Improve over time",
    body: "Learn from feedback. Refine how you work with AI. Build a verifiable developer identity.",
  },
];

const REWARDS = [
  "Thoughtful prompt design",
  "Iterative improvement",
  "Strong validation practices",
  "Clear reasoning and decision-making",
];

const DOES_NOT_REWARD = [
  "Blindly accepting AI output",
  "Minimal or zero iteration",
  "Skipping validation steps",
  "Copy-paste without understanding",
];

const RULES = [
  {
    n: "01",
    title: "Use AI intentionally",
    body: "You are encouraged to use AI, but your approach matters more than the result.",
  },
  {
    n: "02",
    title: "Iterate on your solution",
    body: "High scores come from refining solutions, not from a single attempt.",
  },
  {
    n: "03",
    title: "Validate everything",
    body: "Test your solution, handle edge cases, and fix errors before submitting.",
  },
  {
    n: "04",
    title: "Avoid blind copying",
    body: "Copying AI output without understanding or improvement reduces your score.",
  },
  {
    n: "05",
    title: "Focus on reasoning",
    body: "Your decisions and approach should reflect clear thinking at every step.",
  },
  {
    n: "06",
    title: "Balance speed and correctness",
    body: "Efficiency matters, but correctness and validation always matter more.",
  },
  {
    n: "07",
    title: "Follow challenge requirements",
    body: "Each challenge simulates a real scenario. Respect constraints and instructions.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   Shared nav — mirrors homepage
───────────────────────────────────────────────────────────────────────────── */
async function Nav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      background: "rgba(0,0,0,0.72)",
    }}>
      <div style={{ padding: "0 6vw", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 7,
            background: "#0d0d20", border: "1px solid rgba(139,92,246,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 900, color: "#00dc9b", letterSpacing: "-1px" }}>{"{/}"}</span>
          </div>
          <span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em" }}>
            <span style={{ color: "#fff" }}>Bit</span>
            <span style={{ color: "#8b5cf6" }}>Code</span>
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/challenges", label: "Challenges" },
            { href: "/bounties", label: "Bounties" },
            { href: "/leaderboard", label: "Leaderboard" },
            { href: "/about", label: "About" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="lp-nav-link" style={item.href === "/about" ? { color: "#fff" } : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isLoggedIn ? (
            <Link href="/dashboard" style={{
              background: "#3b82f6", color: "#fff", padding: "8px 20px",
              borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>Go to Dashboard →</Link>
          ) : (
            <>
              <Link href="/auth" style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textDecoration: "none", padding: "8px 14px" }}>Sign in</Link>
              <Link href="/auth" style={{
                background: "#3b82f6", color: "#fff", padding: "8px 20px",
                borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
                boxShadow: "0 0 20px rgba(59,130,246,0.4)",
              }}>Get started →</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────────────────── */
export default async function AboutPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div style={{ background: "#000", color: "#f0f4f8", fontFamily: "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", overflowX: "hidden" }}>
      <Nav isLoggedIn={isLoggedIn} />

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: "72vh", paddingTop: 60, display: "flex", alignItems: "center", position: "relative", overflow: "hidden" }}>
        {/* Glow blobs */}
        <div style={{ position: "absolute", top: "5%", left: "-15%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,220,155,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "0%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ padding: "100px 6vw 80px", width: "100%" }}>
          {/* Eyebrow */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,220,155,0.08)", border: "1px solid rgba(0,220,155,0.2)", borderRadius: 100, padding: "6px 16px", marginBottom: 32 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00dc9b", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#00dc9b", letterSpacing: "0.08em", textTransform: "uppercase" }}>About BitCode</span>
          </div>

          <h1 style={{
            fontSize: "clamp(44px, 6.5vw, 88px)", fontWeight: 900, lineHeight: 1.0,
            letterSpacing: "-0.04em", margin: "0 0 28px", maxWidth: 820,
            background: "linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.6) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Software development<br />
            <span style={{
              background: "linear-gradient(90deg, #00dc9b, #3b82f6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>is changing.</span>
          </h1>

          <p style={{ fontSize: "clamp(17px, 2vw, 22px)", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 620, margin: "0 0 20px" }}>
            Writing code is no longer the hardest part.
          </p>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.35)", lineHeight: 1.8, maxWidth: 560, margin: 0 }}>
            Knowing how to use AI effectively to solve real problems is. BitCode is the platform that measures exactly that.
          </p>
        </div>
      </section>

      {/* ══ THE GAP ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 6vw", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8b5cf6", marginBottom: 14 }}>The problem</div>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 44px)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 16px" }}>There is no standard way to measure</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
            Developers have access to powerful AI tools. But evaluation hasn't caught up.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, alignItems: "stretch", maxWidth: 1000, margin: "0 auto" }}>
          {/* Left: gaps */}
          <div style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px 0 0 16px", padding: "40px 36px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 24 }}>What's missing today</div>
            {[
              "How well someone uses AI",
              "Whether they can debug AI-generated code",
              "If they can validate, iterate, and ship reliably",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#f87171", flexShrink: 0, marginTop: 1 }}>✕</span>
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: "linear-gradient(180deg, transparent, rgba(0,220,155,0.4) 30%, rgba(0,220,155,0.4) 70%, transparent)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#000", border: "1px solid rgba(0,220,155,0.4)", display: "flex", alignItems: "center", justifyContent: "center", position: "absolute", zIndex: 1 }}>
              <span style={{ fontSize: 14, color: "#00dc9b" }}>→</span>
            </div>
          </div>

          {/* Right: what BitCode measures */}
          <div style={{ background: "rgba(0,220,155,0.03)", border: "1px solid rgba(0,220,155,0.15)", borderRadius: "0 16px 16px 0", padding: "40px 36px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#00dc9b", marginBottom: 24 }}>What BitCode measures</div>
            {[
              "Prompt quality and clarity",
              "Iteration strategy and refinement",
              "Debugging ability and validation",
              "Efficiency in reaching a solution",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(0,220,155,0.12)", border: "1px solid rgba(0,220,155,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#00dc9b", flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS — vertical timeline ═════════════════════════════════ */}
      <section style={{ padding: "100px 6vw", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.012)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
          {/* Left: heading */}
          <div style={{ position: "sticky", top: 120 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3b82f6", marginBottom: 16 }}>How it works</div>
            <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 20px", lineHeight: 1.1 }}>
              Five steps to your<br />
              <span style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                AI Skill Score
              </span>
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 380, margin: "0 0 40px" }}>
              The evaluation is built around your process — not just the final answer. Every prompt you write, every iteration you make, is part of your score.
            </p>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(0,220,155,0.6)", background: "rgba(0,220,155,0.05)", border: "1px solid rgba(0,220,155,0.15)", borderRadius: 10, padding: "16px 20px", lineHeight: 2 }}>
              <div style={{ color: "rgba(255,255,255,0.2)" }}>{`// core principle`}</div>
              <div><span style={{ color: "#8b5cf6" }}>evaluate</span>(<span style={{ color: "#f59e0b" }}>"workflow"</span>)</div>
              <div style={{ paddingLeft: 16 }}><span style={{ color: "rgba(255,255,255,0.3)" }}>not</span> <span style={{ color: "#f59e0b" }}>"final_answer"</span></div>
            </div>
          </div>

          {/* Right: timeline */}
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: 27, top: 28, bottom: 28, width: 1, background: "linear-gradient(180deg, rgba(59,130,246,0.4), rgba(139,92,246,0.4), rgba(0,220,155,0.4))" }} />

            {STEPS.map((step, i) => (
              <div key={step.n} style={{ display: "flex", gap: 28, marginBottom: i < STEPS.length - 1 ? 40 : 0, position: "relative" }}>
                {/* Node */}
                <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: "50%", background: `${step.color}18`, border: `2px solid ${step.color}60`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: step.color, fontFamily: "monospace" }}>{step.n}</span>
                  <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: `radial-gradient(circle, ${step.glow} 0%, transparent 70%)` }} />
                </div>
                {/* Content */}
                <div style={{ paddingTop: 14 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>{step.title}</h3>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: 0 }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AI SKILL SCORE ══════════════════════════════════════════════════ */}
      <section style={{ padding: "100px 6vw", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#10b981", marginBottom: 14 }}>Evaluation</div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 16px" }}>AI Skill Score</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
            Your performance is evaluated across five dimensions. Each has a weighted contribution.
          </p>
        </div>

        {/* Dimension cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 40 }}>
          {SCORE_DIMENSIONS.map((d) => (
            <div key={d.key} style={{
              background: "rgba(255,255,255,0.02)", border: `1px solid ${d.color}28`,
              borderRadius: 14, padding: "24px 20px", position: "relative", overflow: "hidden",
            }}>
              {/* Glow top */}
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "80%", height: 1, background: `linear-gradient(90deg, transparent, ${d.color}60, transparent)` }} />
              {/* Pct badge */}
              <div style={{ fontSize: 28, fontWeight: 900, color: d.color, lineHeight: 1, marginBottom: 10, fontFamily: "monospace" }}>{d.pct}<span style={{ fontSize: 14 }}>%</span></div>
              {/* Bar */}
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${d.pct * 4}%`, borderRadius: 2, background: d.color, boxShadow: `0 0 8px ${d.glow}` }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{d.key}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.bullets.map((b) => (
                  <div key={b} style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.4, paddingLeft: 10, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, top: 5, width: 4, height: 4, borderRadius: "50%", background: d.color, display: "block" }} />
                    {b}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Formula */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "28px 36px",
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Score formula</span>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontFamily: "monospace", fontSize: 13 }}>
            {SCORE_DIMENSIONS.map((d, i) => (
              <span key={d.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: d.color, fontWeight: 700 }}>({d.key.split(" ")[0]} × {d.pct / 100})</span>
                {i < SCORE_DIMENSIONS.length - 1 && <span style={{ color: "rgba(255,255,255,0.25)" }}>+</span>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ REWARDS / DOES NOT REWARD ════════════════════════════════════════ */}
      <section style={{ padding: "80px 6vw 100px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.012)" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 14 }}>Values</div>
          <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>What BitCode rewards</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 860, margin: "0 auto" }}>
          {/* Rewards */}
          <div style={{ background: "rgba(0,220,155,0.03)", border: "1px solid rgba(0,220,155,0.15)", borderRadius: 16, padding: "36px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,220,155,0.12)", border: "1px solid rgba(0,220,155,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#00dc9b" }}>BitCode rewards</span>
            </div>
            {REWARDS.map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00dc9b", boxShadow: "0 0 8px rgba(0,220,155,0.5)", flexShrink: 0 }} />
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>

          {/* Does not reward */}
          <div style={{ background: "rgba(239,68,68,0.025)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: 16, padding: "36px 32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#f87171" }}>✕</div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>BitCode does not reward</span>
            </div>
            {DOES_NOT_REWARD.map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", flexShrink: 0, opacity: 0.6 }} />
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ RULES ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "100px 6vw", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "start" }}>
          {/* Left: heading */}
          <div style={{ position: "sticky", top: 120 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8b5cf6", marginBottom: 16 }}>Rules & guidelines</div>
            <h2 style={{ fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 20px", lineHeight: 1.15 }}>
              How to play<br />
              <span style={{ background: "linear-gradient(90deg, #8b5cf6, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                the right way
              </span>
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: 360 }}>
              BitCode evaluates your workflow, not just your final answer. The goal is not to finish fast — it is to solve problems effectively using AI.
            </p>
          </div>

          {/* Right: rule cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {RULES.map((rule, i) => (
              <div key={rule.n} style={{
                display: "flex", gap: 20, padding: "20px 24px",
                borderRadius: 12, transition: "background 0.15s",
                borderBottom: i < RULES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 900, color: "rgba(139,92,246,0.6)",
                  fontFamily: "monospace", letterSpacing: "0.05em", flexShrink: 0, paddingTop: 2,
                  width: 24,
                }}>
                  {rule.n}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{rule.title}</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.65 }}>{rule.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PRINCIPLE ════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 6vw", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.012)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 24 }}>Core principle</div>

          <blockquote style={{
            fontSize: "clamp(22px, 3.5vw, 38px)", fontWeight: 800, lineHeight: 1.3,
            letterSpacing: "-0.02em", margin: "0 0 24px",
            background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            "The goal is not to finish fast. The goal is to solve problems effectively using AI."
          </blockquote>
        </div>
      </section>

      {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "120px 6vw", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,220,155,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 580, margin: "0 auto", position: "relative" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#00dc9b", marginBottom: 20 }}>Get started free</div>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 58px)", fontWeight: 900, letterSpacing: "-0.03em", margin: "0 0 20px", lineHeight: 1.1 }}>
            Ready to prove your<br />AI skills?
          </h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, margin: "0 0 48px" }}>
            Join developers building a verifiable AI Skill Score. Sign in and start your first challenge in under a minute.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/challenges" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#3b82f6", color: "#fff", padding: "15px 32px",
              borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 0 32px rgba(59,130,246,0.45)",
            }}>
              Browse Challenges →
            </Link>
            <Link href="/auth" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.8)",
              padding: "15px 32px", borderRadius: 12, fontSize: 15, fontWeight: 600,
              textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)",
            }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px 6vw" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em" }}>
              <span style={{ color: "#fff" }}>Bit</span>
              <span style={{ color: "#8b5cf6" }}>Code</span>
            </span>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginTop: 6 }}>
              The AI-native developer platform. &copy; {new Date().getFullYear()}
            </div>
          </div>
          <nav style={{ display: "flex", gap: 24 }}>
            {[
              { href: "/challenges", label: "Challenges" },
              { href: "/bounties", label: "Bounties" },
              { href: "/leaderboard", label: "Leaderboard" },
              { href: "/about", label: "About" },
            ].map((l) => (
              <Link key={l.href} href={l.href} style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>

      <style>{`
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
