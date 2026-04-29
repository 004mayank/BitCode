"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiGet, apiPost, API_BASE } from "./api";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── Language registry ─────────────────────────────────────────────────────────

type Lang = {
  id: string;
  label: string;
  icon: string;
  ext: string;
  runnable: boolean;
  starter: string;
};

const LANGUAGES: Lang[] = [
  { id: "python",     label: "Python",     icon: "🐍", ext: "py",   runnable: true,  starter: "# Python\n\nprint('Hello, BitCode!')\n" },
  { id: "javascript", label: "JavaScript", icon: "🟨", ext: "js",   runnable: false, starter: "// JavaScript\n\nconsole.log('Hello, BitCode!');\n" },
  { id: "typescript", label: "TypeScript", icon: "🔷", ext: "ts",   runnable: false, starter: "// TypeScript\n\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet('BitCode'));\n" },
  { id: "go",         label: "Go",         icon: "🐹", ext: "go",   runnable: false, starter: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, BitCode!\")\n}\n" },
  { id: "rust",       label: "Rust",       icon: "🦀", ext: "rs",   runnable: false, starter: "fn main() {\n    println!(\"Hello, BitCode!\");\n}\n" },
  { id: "java",       label: "Java",       icon: "☕", ext: "java", runnable: false, starter: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, BitCode!\");\n    }\n}\n" },
  { id: "cpp",        label: "C++",        icon: "⚙️", ext: "cpp",  runnable: false, starter: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, BitCode!\" << std::endl;\n    return 0;\n}\n" },
  { id: "csharp",     label: "C#",         icon: "🔵", ext: "cs",   runnable: false, starter: "using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"Hello, BitCode!\");\n    }\n}\n" },
  { id: "ruby",       label: "Ruby",       icon: "💎", ext: "rb",   runnable: false, starter: "# Ruby\n\nputs 'Hello, BitCode!'\n" },
  { id: "php",        label: "PHP",        icon: "🐘", ext: "php",  runnable: false, starter: "<?php\n\necho 'Hello, BitCode!';\n" },
  { id: "shell",      label: "Bash",       icon: "🖥",  ext: "sh",   runnable: false, starter: "#!/bin/bash\n\necho \"Hello, BitCode!\"\n" },
  { id: "sql",        label: "SQL",        icon: "🗄",  ext: "sql",  runnable: false, starter: "-- SQL\n\nSELECT 'Hello, BitCode!' AS greeting;\n" },
];

const DEFAULT_LANG = LANGUAGES[0];

// ── Types ─────────────────────────────────────────────────────────────────────

type Challenge   = { id: string; title: string; description: string; prompt: string; tags: string[]; difficulty: number; rubric?: any };
type Attempt     = { id: string; challengeId: string; status: string; submissionUrl?: string | null };
type ScoreBreakdown = { promptQuality: number; iterationIntelligence: number; efficiency: number; correctnessProxy: number; total: number; notes: string[] };
type ChatMessage = { role: "user" | "assistant"; content: string; ts: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(n: number) {
  if (n >= 75) return "var(--green)";
  if (n >= 50) return "var(--yellow)";
  return "var(--red)";
}

function DiffBadge({ d }: { d: number }) {
  const map: Record<number, [string, string]> = {
    1: ["Easy",   "var(--green)"],
    2: ["Easy+",  "var(--green)"],
    3: ["Medium", "var(--yellow)"],
    4: ["Hard",   "var(--red)"],
    5: ["Expert", "var(--purple)"],
  };
  const [label, color] = map[d] ?? [`L${d}`, "var(--text-3)"];
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color, background: `${color}18`, padding: "3px 8px", borderRadius: 999, border: `1px solid ${color}40`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const c = scoreColor(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: "var(--text-2)" }}>{label}</span>
        <span style={{ fontWeight: 700, color: c }}>{value}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%`, background: c }} />
      </div>
    </div>
  );
}

function ScorePanel({ score }: { score: ScoreBreakdown }) {
  const c = scoreColor(score.total);
  const r = 38, circ = 2 * Math.PI * r, filled = (score.total / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width={96} height={96} viewBox="0 0 96 96" style={{ flexShrink: 0 }}>
          <circle cx={48} cy={48} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
          <circle cx={48} cy={48} r={r} fill="none" stroke={c} strokeWidth={6}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round" transform="rotate(-90 48 48)" />
          <text x={48} y={53} textAnchor="middle" fill={c} fontSize={20} fontWeight={800}>{score.total}</text>
        </svg>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>AI Skill Score</div>
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
            {score.total >= 75 ? "🏆 Great AI workflow" : score.total >= 50 ? "👍 Solid attempt" : "📈 Needs improvement"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ScoreBar label="Prompt Quality"          value={score.promptQuality} />
        <ScoreBar label="Iteration Intelligence"  value={score.iterationIntelligence} />
        <ScoreBar label="Efficiency"              value={score.efficiency} />
        <ScoreBar label="Correctness Proxy"       value={score.correctnessProxy} />
      </div>
      {score.notes.length > 0 && (
        <div style={{ padding: 10, borderRadius: 8, background: "var(--yellow-dim)", border: "1px solid rgba(245,158,11,0.2)" }}>
          {score.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--yellow)" }}>⚠ {n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function Steps({ step }: { step: number }) {
  const steps = ["Start", "Code", "Submit", "Score"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14 }}>
      {steps.map((s, i) => {
        const done    = i < step;
        const current = i === step;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                background: done ? "var(--green)" : current ? "var(--blue)" : "var(--border)",
                color: done || current ? "#fff" : "var(--text-3)",
                border: current ? "2px solid var(--blue)" : "2px solid transparent",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <div style={{ fontSize: 10, color: current ? "var(--text-1)" : done ? "var(--green)" : "var(--text-3)", fontWeight: current ? 700 : 400, whiteSpace: "nowrap" }}>
                {s}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "var(--green)" : "var(--border)", margin: "0 4px", marginBottom: 14 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      gap: 3,
    }}>
      <div style={{
        maxWidth: "88%",
        padding: "9px 13px",
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        background: isUser ? "var(--blue)" : "var(--card)",
        color: isUser ? "#fff" : "var(--text-1)",
        fontSize: 13,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        border: isUser ? "none" : "1px solid var(--border)",
      }}>
        {msg.content}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-3)", paddingInline: 4 }}>
        {isUser ? "You" : "BitCode AI"} · {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

// ── Storage key ───────────────────────────────────────────────────────────────

function storageKey(challengeId: string, langId: string) {
  return `bc-code:${challengeId}:${langId}`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChallengeAttempt({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge]   = useState<Challenge | null>(null);
  const [attempt, setAttempt]       = useState<Attempt | null>(null);

  const [lang, setLang]             = useState<Lang>(DEFAULT_LANG);
  const [codeMap, setCodeMap]       = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    LANGUAGES.forEach((l) => { m[l.id] = l.starter; });
    return m;
  });

  const [runId, setRunId]           = useState<string | null>(null);
  const [runLogs, setRunLogs]       = useState<string[]>([]);
  const [running, setRunning]       = useState(false);
  const [runResult, setRunResult]   = useState<any | null>(null);

  const [score, setScore]           = useState<ScoreBreakdown | null>(null);
  const [evalLogs, setEvalLogs]     = useState<string[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const [err, setErr]               = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<"editor" | "score">("editor");

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const chatEndRef   = useRef<HTMLDivElement>(null);

  const esRef      = useRef<EventSource | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Current code for active lang
  const code = codeMap[lang.id] ?? lang.starter;
  function setCode(v: string) {
    setCodeMap((m) => {
      const next = { ...m, [lang.id]: v };
      try { localStorage.setItem(storageKey(challengeId, lang.id), v); } catch {}
      return next;
    });
  }

  // Load saved code from localStorage on mount
  useEffect(() => {
    setCodeMap((m) => {
      const next = { ...m };
      LANGUAGES.forEach((l) => {
        try {
          const saved = localStorage.getItem(storageKey(challengeId, l.id));
          if (saved !== null) next[l.id] = saved;
        } catch {}
      });
      return next;
    });
  }, [challengeId]);

  // Load challenge
  useEffect(() => {
    apiGet<{ ok: true; challenges: Challenge[] }>("/api/challenges")
      .then((j) => j.challenges.find((c) => c.id === challengeId) ?? null)
      .then(setChallenge)
      .catch((e) => setErr(String(e?.message || e)));
  }, [challengeId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function switchLang(l: Lang) { setLang(l); }

  function resetCode() {
    setCode(lang.starter);
    try { localStorage.removeItem(storageKey(challengeId, lang.id)); } catch {}
  }

  const isCodeModified = code !== lang.starter;

  // ── Attempt actions ──────────────────────────────────────────────────────

  async function startAttempt() {
    setErr(null);
    try {
      const j = await apiPost<{ ok: true; attempt: Attempt }>("/api/attempts", { challengeId });
      setAttempt(j.attempt);
    } catch (e: any) { setErr(String(e?.message || e)); }
  }

  async function submit() {
    if (!attempt) return;
    setErr(null);
    setEvaluating(true);
    setScore(null);
    setActiveTab("score");
    try {
      // 1. Mark submitted
      await apiPost("/api/attempts/submit", { attemptId: attempt.id, submissionUrl: null });
      setAttempt({ ...attempt, status: "SUBMITTED" });

      // 2. Stream evaluation
      const resp = await fetch(`${API_BASE}/api/attempts/${attempt.id}/evaluate/stream`);
      const reader = resp.body?.getReader();
      const dec = new TextDecoder();
      let buf = "", event = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (event === "log")   setEvalLogs((l) => [...l, data.message]);
            if (event === "score") setScore(data);
            if (event === "done")  setAttempt((a) => a ? { ...a, status: "EVALUATED" } : a);
          }
        }
      }
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setEvaluating(false); }
  }

  // ── Code runner ──────────────────────────────────────────────────────────

  async function runCode() {
    if (!lang.runnable || running) return;
    setErr(null); setRunLogs([]); setRunResult(null); setRunning(true);
    try {
      const j = await apiPost<{ ok: true; runId: string }>("/api/run", {
        language: "python", entry: `main.${lang.ext}`,
        timeoutMs: 10000, files: [{ path: `main.${lang.ext}`, content: code }]
      });
      setRunId(j.runId);
      esRef.current?.close();
      const es = new EventSource(`${API_BASE}/api/run/${j.runId}/stream`);
      esRef.current = es;
      es.addEventListener("log",  (ev: any) => {
        const d = JSON.parse(ev.data);
        setRunLogs((l) => [...l, d.line]);
        setTimeout(() => { consoleRef.current?.scrollTo(0, consoleRef.current.scrollHeight); }, 10);
      });
      es.addEventListener("done", (ev: any) => { setRunResult(JSON.parse(ev.data)); es.close(); setRunning(false); });
      es.onerror = () => { setRunLogs((l) => [...l, "[runner disconnected]"]); es.close(); setRunning(false); };
    } catch (e: any) { setErr(String(e?.message || e)); setRunning(false); }
  }

  useEffect(() => () => { esRef.current?.close(); }, []);

  // ── Chat ─────────────────────────────────────────────────────────────────

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text, ts: Date.now() };
    setChatMessages((m) => [...m, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
      const challengeContext = challenge
        ? `Title: ${challenge.title}\n\nProblem:\n${challenge.prompt}`
        : undefined;

      const j = await apiPost<{ ok: true; reply: string }>("/api/chat", {
        attemptId: attempt?.id,
        message: text,
        history,
        challengeContext
      });

      setChatMessages((m) => [...m, { role: "assistant", content: j.reply, ts: Date.now() }]);
    } catch (e: any) {
      setChatMessages((m) => [...m, { role: "assistant", content: `Error: ${String(e?.message || e)}`, ts: Date.now() }]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  }

  // ── Step computation ─────────────────────────────────────────────────────

  const step = !attempt ? 0 : attempt.status === "EVALUATED" ? 3 : attempt.status === "SUBMITTED" ? 2 : 1;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr 320px", gap: 14, height: "calc(100vh - 110px)" }}>

      {/* ── Left panel: Problem ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 2 }}>

        {/* Progress steps + Start/Status */}
        <div className="card" style={{ padding: "14px 18px 14px" }}>
          <Steps step={step} />
          {!attempt ? (
            <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={startAttempt}>
              ▶ Start Attempt
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", display: "inline-block",
                  background: attempt.status === "EVALUATED" ? "var(--green)" : attempt.status === "SUBMITTED" ? "var(--yellow)" : "var(--blue)"
                }} />
                <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{attempt.status}</span>
                <span style={{ color: "var(--text-3)" }}>· {attempt.id.slice(0, 8)}…</span>
              </div>
              <button
                className="btn sm"
                disabled={attempt.status === "EVALUATED" || evaluating}
                onClick={submit}
                style={{ whiteSpace: "nowrap" }}
              >
                {evaluating ? "Scoring…" : attempt.status === "EVALUATED" ? "✓ Done" : "Submit & Score"}
              </button>
            </div>
          )}
          {err && <div style={{ color: "var(--red)", marginTop: 8, fontSize: 12 }}>{err}</div>}
        </div>

        {/* Problem */}
        <div className="card" style={{ padding: 18, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>{challenge?.title ?? "Loading…"}</div>
            {challenge && <DiffBadge d={challenge.difficulty} />}
          </div>
          <div style={{ color: "var(--text-2)", marginTop: 6, fontSize: 13 }}>{challenge?.description}</div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>Problem Statement</div>
            <div style={{ whiteSpace: "pre-wrap", color: "var(--text-1)", lineHeight: 1.7, fontSize: 13 }}>{challenge?.prompt}</div>
          </div>

          {challenge?.rubric && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.05)" }}>
              <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--purple)", marginBottom: 8 }}>Scoring Rubric</div>
              {Object.entries(challenge.rubric).map(([k, v]: any) => (
                <div key={k} style={{ marginBottom: 6, fontSize: 12, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-2)", textTransform: "capitalize" }}>{k}: </span>
                  <span style={{ color: "var(--text-2)" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Middle panel: Editor ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", minHeight: 0 }}>

        {/* Language selector */}
        <div className="card" style={{ padding: "10px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)" }}>Language</span>
            {!lang.runnable && (
              <span style={{ fontSize: 11, color: "var(--yellow)", background: "var(--yellow-dim)", padding: "1px 8px", borderRadius: 999, border: "1px solid rgba(245,158,11,0.25)" }}>
                Run: Python only
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {LANGUAGES.map((l) => {
              const hasChanges = codeMap[l.id] !== l.starter;
              return (
                <button
                  key={l.id}
                  className={`lang-btn${lang.id === l.id ? " active" : ""}`}
                  onClick={() => switchLang(l)}
                  title={l.label}
                  style={{ position: "relative" }}
                >
                  <span>{l.icon}</span>{l.label}
                  {hasChanges && (
                    <span style={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: "50%", background: "var(--blue)" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab bar */}
        <div className="card" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {([
            { id: "editor", label: "⌨ Editor" },
            { id: "score",  label: `📊 Score${score ? ` · ${score.total}` : ""}` },
          ] as const).map((t) => (
            <button key={t.id} className={`btn sm ${activeTab === t.id ? "" : "ghost"}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}

          {activeTab === "editor" && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {isCodeModified && (
                <button className="btn sm ghost" onClick={resetCode} title="Reset to starter code">
                  ↺ Reset
                </button>
              )}
              <button
                className={`btn sm ${running ? "secondary" : ""}`}
                onClick={runCode}
                disabled={!lang.runnable || running}
                title={lang.runnable ? "Run code (Python)" : `Execution not available for ${lang.label}`}
              >
                {running ? "⏳ Running…" : `▶ Run ${lang.icon}`}
              </button>
            </div>
          )}
        </div>

        {/* Editor tab */}
        {activeTab === "editor" && (
          <>
            <div className="card" style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
              <MonacoEditor
                height="100%"
                language={lang.id}
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  padding: { top: 12 },
                  renderLineHighlight: "gutter",
                  smoothScrolling: true,
                }}
              />
            </div>

            {/* Console */}
            <div className="card" style={{ flexShrink: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)" }}>
                  Console {running && <span style={{ color: "var(--blue)" }}>· running…</span>}
                  {runResult && (
                    <span style={{ color: runResult.status === "done" ? "var(--green)" : "var(--red)", marginLeft: 6 }}>
                      · exit {runResult.exitCode ?? (runResult.status === "done" ? 0 : 1)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {runId && <span className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{runId.slice(0, 8)}</span>}
                  {(runLogs.length > 0 || runResult) && (
                    <button className="btn sm ghost" onClick={() => { setRunLogs([]); setRunResult(null); setRunId(null); }} style={{ fontSize: 10, padding: "1px 6px" }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div ref={consoleRef} className="mono" style={{ fontSize: 12, color: "var(--text-2)", padding: "10px 12px", maxHeight: 140, overflowY: "auto" }}>
                {runLogs.length > 0
                  ? runLogs.map((l, i) => <div key={i} style={{ lineHeight: 1.6 }}>{l}</div>)
                  : <div style={{ color: "var(--text-3)" }}>
                      {lang.runnable
                        ? "No output yet. Click ▶ Run."
                        : `${lang.label} execution coming soon.`}
                    </div>
                }
              </div>
            </div>
          </>
        )}

        {/* Score tab */}
        {activeTab === "score" && (
          <div className="card" style={{ padding: 20, flex: 1, overflow: "auto", minHeight: 0 }}>
            {evaluating && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>Analyzing your workflow…</div>
                {evalLogs.map((l, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--text-2)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ color: "var(--blue)" }}>›</span> {l}
                  </div>
                ))}
              </div>
            )}
            {!evaluating && score && <ScorePanel score={score} />}
            {!evaluating && !score && (
              <div style={{ color: "var(--text-3)", textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📊</div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>No score yet</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Start an attempt, chat with the AI assistant, then click <strong>Submit & Score</strong>.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right panel: AI Chat ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, overflow: "hidden", minHeight: 0 }} className="card">

        {/* Chat header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
          <div style={{ fontWeight: 700, fontSize: 13 }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
            {chatMessages.filter(m => m.role === "user").length} prompts
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
          {chatMessages.length === 0 ? (
            <div style={{ color: "var(--text-3)", textAlign: "center", padding: "40px 16px" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text-2)" }}>Ask the AI anything</div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                All your prompts are automatically captured and used to score your AI usage quality.
              </div>
            </div>
          ) : (
            chatMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)
          )}
          {chatLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "var(--text-3)",
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Thinking…</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          {!attempt && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, padding: "5px 8px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", textAlign: "center" }}>
              Start an attempt to enable AI chat
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              className="textarea"
              rows={3}
              placeholder={attempt ? "Ask about the problem, request hints, debug together… (Enter to send)" : "Start an attempt first"}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKey}
              disabled={!attempt || chatLoading}
              style={{ flex: 1, resize: "none", fontSize: 13 }}
            />
            <button
              className="btn"
              onClick={sendChat}
              disabled={!attempt || !chatInput.trim() || chatLoading}
              style={{ padding: "9px 12px", alignSelf: "flex-end", flexShrink: 0 }}
              title="Send (Enter)"
            >
              ↑
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 5 }}>
            Shift+Enter for new line · prompts auto-logged
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
