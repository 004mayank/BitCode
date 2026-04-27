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
type LoggedEvent = { type: string; text: string; ts: number };
type ScoreBreakdown = { promptQuality: number; iterationIntelligence: number; efficiency: number; correctnessProxy: number; total: number; notes: string[] };

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

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
  const steps = ["Start", "Code & Log", "Submit", "Score"];
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

// ── Main component ────────────────────────────────────────────────────────────

function storageKey(challengeId: string, langId: string) {
  return `bc-code:${challengeId}:${langId}`;
}

export function ChallengeAttempt({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge]   = useState<Challenge | null>(null);
  const [attempt, setAttempt]       = useState<Attempt | null>(null);
  const [submissionUrl, setUrl]     = useState("");
  const [workflowNote, setNote]     = useState("");
  const [loggedEvents, setEvents]   = useState<LoggedEvent[]>([]);

  const [lang, setLang]             = useState<Lang>(DEFAULT_LANG);
  // Per-language code map – keys are lang.id, values are current code
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
  const [activeTab, setActiveTab]   = useState<"editor" | "events" | "score">("editor");

  const esRef     = useRef<EventSource | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Current code for active lang
  const code = codeMap[lang.id] ?? lang.starter;
  function setCode(v: string) {
    setCodeMap((m) => {
      const next = { ...m, [lang.id]: v };
      // Persist to localStorage
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

  // Load challenge + any existing in-progress attempt
  useEffect(() => {
    apiGet<{ ok: true; challenges: Challenge[] }>("/api/challenges")
      .then((j) => j.challenges.find((c) => c.id === challengeId) ?? null)
      .then(setChallenge)
      .catch((e) => setErr(String(e?.message || e)));
  }, [challengeId]);

  // Switch language – preserves code in each slot
  function switchLang(l: Lang) {
    setLang(l);
    // code for new lang is already in codeMap (or starter if never touched)
  }

  function resetCode() {
    const starter = lang.starter;
    setCode(starter);
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

  async function logWorkflow(type: "prompt" | "iteration" | "note") {
    if (!attempt || !workflowNote.trim()) return;
    const text = workflowNote.trim();
    const ts = Date.now();
    try {
      await apiPost("/api/attempts/events", { attemptId: attempt.id, type, text });
      setEvents((ev) => [...ev, { type, text, ts }]);
      setNote("");
      // Auto-switch to events tab so user sees the logged entry
      setActiveTab("events");
    } catch (e: any) { setErr(String(e?.message || e)); }
  }

  async function submit() {
    if (!attempt) return;
    setErr(null);
    try {
      await apiPost("/api/attempts/submit", { attemptId: attempt.id, submissionUrl });
      setAttempt({ ...attempt, status: "SUBMITTED", submissionUrl });
    } catch (e: any) { setErr(String(e?.message || e)); }
  }

  async function getToken() {
    try { const r = await fetch("/api/api-token", { cache: "no-store" }); return (await r.json())?.token ?? null; }
    catch { return null; }
  }

  async function evaluate() {
    if (!attempt) return;
    setEvaluating(true); setScore(null); setEvalLogs([]); setActiveTab("score");
    const token = await getToken();
    try {
      const resp = await fetch(`${API_BASE}/api/attempts/${attempt.id}/evaluate/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
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
        // Auto-scroll console
        setTimeout(() => { consoleRef.current?.scrollTo(0, consoleRef.current.scrollHeight); }, 10);
      });
      es.addEventListener("done", (ev: any) => { setRunResult(JSON.parse(ev.data)); es.close(); setRunning(false); });
      es.onerror = () => { setRunLogs((l) => [...l, "[runner disconnected]"]); es.close(); setRunning(false); };
    } catch (e: any) { setErr(String(e?.message || e)); setRunning(false); }
  }

  useEffect(() => () => { esRef.current?.close(); }, []);

  // ── Step computation ─────────────────────────────────────────────────────

  const step = !attempt ? 0 : attempt.status === "EVALUATED" ? 3 : attempt.status === "SUBMITTED" ? 2 : 1;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, height: "calc(100vh - 110px)" }}>

      {/* ── Left panel ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 2 }}>

        {/* Progress steps */}
        <div className="card" style={{ padding: "14px 18px 10px" }}>
          <Steps step={step} />

          {/* Start attempt CTA */}
          {!attempt ? (
            <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={startAttempt}>
              ▶ Start Attempt
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", display: "inline-block",
                background: attempt.status === "EVALUATED" ? "var(--green)" : attempt.status === "SUBMITTED" ? "var(--yellow)" : "var(--blue)"
              }} />
              <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{attempt.status}</span>
              <span style={{ color: "var(--text-3)" }}>· {attempt.id.slice(0, 8)}…</span>
            </div>
          )}
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

        {/* Workflow log */}
        <div className="card" style={{ padding: 18, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)" }}>
              Workflow Log
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>{loggedEvents.length} events</div>
          </div>
          {!attempt && (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8, padding: "6px 10px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}>
              ↑ Start an attempt first to log events
            </div>
          )}
          <textarea className="textarea" rows={4}
            placeholder="Paste your AI prompt, describe an iteration, or add a debugging note…"
            value={workflowNote}
            onChange={(e) => setNote(e.target.value)}
            disabled={!attempt}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn sm"           disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("prompt")}>
              💬 Log Prompt
            </button>
            <button className="btn sm secondary" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("iteration")}>
              🔄 Iteration
            </button>
            <button className="btn sm secondary" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("note")}>
              📝 Note
            </button>
          </div>
        </div>

        {/* Submit + Score */}
        <div className="card" style={{ padding: 18, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 12 }}>
            Submit & Score
          </div>

          <input
            className="input"
            placeholder="GitHub repo or PR URL (optional)"
            value={submissionUrl}
            onChange={(e) => setUrl(e.target.value)}
            disabled={!attempt || attempt.status === "EVALUATED"}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              className="btn"
              style={{ flex: 1, justifyContent: "center" }}
              disabled={!attempt || attempt.status === "EVALUATED"}
              onClick={submit}
            >
              {attempt?.status === "SUBMITTED" || attempt?.status === "EVALUATED" ? "✓ Submitted" : "Submit"}
            </button>
            <button
              className="btn secondary"
              style={{ flex: 1, justifyContent: "center" }}
              disabled={!attempt || evaluating}
              onClick={evaluate}
            >
              {evaluating ? "Scoring…" : "Get AI Score"}
            </button>
          </div>

          {loggedEvents.length === 0 && attempt && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--yellow)", padding: "6px 10px", borderRadius: 6, background: "var(--yellow-dim)", border: "1px solid rgba(245,158,11,0.2)" }}>
              ⚠ Log at least one prompt before scoring for a meaningful result.
            </div>
          )}

          {err && <div style={{ color: "var(--red)", marginTop: 8, fontSize: 12 }}>{err}</div>}
        </div>
      </div>

      {/* ── Right panel ── */}
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
            { id: "events", label: `📋 Events${loggedEvents.length ? ` (${loggedEvents.length})` : ""}` },
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

        {/* ── Editor tab ── */}
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
                        : `${lang.label} execution coming soon — submit your repo URL to get scored.`}
                    </div>
                }
              </div>
            </div>
          </>
        )}

        {/* ── Events tab ── */}
        {activeTab === "events" && (
          <div className="card" style={{ padding: 18, flex: 1, overflow: "auto", minHeight: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Logged Events</span>
              <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400 }}>{loggedEvents.length} total</span>
            </div>
            {loggedEvents.length === 0 ? (
              <div style={{ color: "var(--text-3)", textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13 }}>No events yet.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Use the Workflow Log on the left to capture your AI prompts and iterations.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loggedEvents.map((ev, i) => {
                  const typeColor = ev.type === "prompt" ? "var(--blue)" : ev.type === "iteration" ? "var(--green)" : "var(--text-3)";
                  const typeIcon  = ev.type === "prompt" ? "💬" : ev.type === "iteration" ? "🔄" : "📝";
                  return (
                    <div key={i} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13 }}>{typeIcon}</span>
                        <span style={{ color: typeColor, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{ev.type}</span>
                        <span style={{ color: "var(--text-3)", fontSize: 11 }}>#{i + 1}</span>
                        <span style={{ color: "var(--text-3)", fontSize: 11, marginLeft: "auto" }}>{fmt(ev.ts)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{ev.text}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Score tab ── */}
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
                  Start an attempt, log your AI prompts and iterations, then click <strong>Get AI Score</strong> on the left.
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
