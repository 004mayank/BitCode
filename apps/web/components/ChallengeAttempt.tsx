"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, API_BASE } from "./api";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── Language registry ────────────────────────────────────────────────────────

type Lang = {
  id: string;          // Monaco language id
  label: string;
  icon: string;
  ext: string;         // default filename extension
  runnable: boolean;   // supported by docker runner
  starter: string;
};

const LANGUAGES: Lang[] = [
  { id: "python",      label: "Python",     icon: "🐍", ext: "py",   runnable: true,  starter: "# Python\n\nprint('Hello, BitCode!')\n" },
  { id: "javascript",  label: "JavaScript", icon: "🟨", ext: "js",   runnable: false, starter: "// JavaScript\n\nconsole.log('Hello, BitCode!');\n" },
  { id: "typescript",  label: "TypeScript", icon: "🔷", ext: "ts",   runnable: false, starter: "// TypeScript\n\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet('BitCode'));\n" },
  { id: "go",          label: "Go",         icon: "🐹", ext: "go",   runnable: false, starter: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, BitCode!\")\n}\n" },
  { id: "rust",        label: "Rust",       icon: "🦀", ext: "rs",   runnable: false, starter: "fn main() {\n    println!(\"Hello, BitCode!\");\n}\n" },
  { id: "java",        label: "Java",       icon: "☕", ext: "java", runnable: false, starter: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, BitCode!\");\n    }\n}\n" },
  { id: "cpp",         label: "C++",        icon: "⚙️", ext: "cpp",  runnable: false, starter: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, BitCode!\" << std::endl;\n    return 0;\n}\n" },
  { id: "csharp",      label: "C#",         icon: "🔵", ext: "cs",   runnable: false, starter: "using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"Hello, BitCode!\");\n    }\n}\n" },
  { id: "ruby",        label: "Ruby",       icon: "💎", ext: "rb",   runnable: false, starter: "# Ruby\n\nputs 'Hello, BitCode!'\n" },
  { id: "php",         label: "PHP",        icon: "🐘", ext: "php",  runnable: false, starter: "<?php\n\necho 'Hello, BitCode!';\n" },
  { id: "shell",       label: "Bash",       icon: "🖥",  ext: "sh",   runnable: false, starter: "#!/bin/bash\n\necho \"Hello, BitCode!\"\n" },
  { id: "sql",         label: "SQL",        icon: "🗄",  ext: "sql",  runnable: false, starter: "-- SQL\n\nSELECT 'Hello, BitCode!' AS greeting;\n" },
];

const DEFAULT_LANG = LANGUAGES[0];

// ── Types ────────────────────────────────────────────────────────────────────

type Challenge = { id: string; title: string; description: string; prompt: string; tags: string[]; difficulty: number; rubric?: any };
type Attempt   = { id: string; challengeId: string; status: string; submissionUrl?: string | null };
type ScoreBreakdown = { promptQuality: number; iterationIntelligence: number; efficiency: number; correctnessProxy: number; total: number; notes: string[] };

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(n: number) {
  if (n >= 75) return "var(--green)";
  if (n >= 50) return "var(--yellow)";
  return "var(--red)";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width={96} height={96} viewBox="0 0 96 96" style={{ flexShrink: 0 }}>
          <circle cx={48} cy={48} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
          <circle cx={48} cy={48} r={r} fill="none" stroke={c} strokeWidth={6}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round" transform="rotate(-90 48 48)" />
          <text x={48} y={53} textAnchor="middle" fill={c} fontSize={20} fontWeight={800}>{score.total}</text>
        </svg>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>AI Skill Score</div>
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 2 }}>
            {score.total >= 75 ? "🏆 Great AI workflow" : score.total >= 50 ? "👍 Solid attempt" : "📈 Needs improvement"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ScoreBar label="Prompt Quality" value={score.promptQuality} />
        <ScoreBar label="Iteration Intelligence" value={score.iterationIntelligence} />
        <ScoreBar label="Efficiency" value={score.efficiency} />
        <ScoreBar label="Correctness Proxy" value={score.correctnessProxy} />
      </div>
      {score.notes.length > 0 && (
        <div style={{ padding: 10, borderRadius: 8, background: "var(--yellow-dim)", border: "1px solid rgba(245,158,11,0.2)" }}>
          {score.notes.map((n, i) => <div key={i} style={{ fontSize: 12, color: "var(--yellow)" }}>⚠ {n}</div>)}
        </div>
      )}
    </div>
  );
}

// ── Language selector ─────────────────────────────────────────────────────────

function LangSelector({ selected, onChange }: { selected: Lang; onChange: (l: Lang) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          className={`lang-btn${selected.id === l.id ? " active" : ""}`}
          onClick={() => onChange(l)}
          title={l.label}
        >
          <span>{l.icon}</span>{l.label}
        </button>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChallengeAttempt({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge]     = useState<Challenge | null>(null);
  const [attempt, setAttempt]         = useState<Attempt | null>(null);
  const [submissionUrl, setUrl]       = useState("");
  const [workflowNote, setNote]       = useState("");
  const [loggedEvents, setEvents]     = useState<{ type: string; text: string }[]>([]);

  const [lang, setLang]               = useState<Lang>(DEFAULT_LANG);
  const [code, setCode]               = useState(DEFAULT_LANG.starter);

  const [runId, setRunId]             = useState<string | null>(null);
  const [runLogs, setRunLogs]         = useState<string[]>([]);
  const [runResult, setRunResult]     = useState<any | null>(null);

  const [score, setScore]             = useState<ScoreBreakdown | null>(null);
  const [evalLogs, setEvalLogs]       = useState<string[]>([]);
  const [evaluating, setEvaluating]   = useState(false);

  const [err, setErr]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState<"editor" | "workflow" | "score">("editor");

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    apiGet<{ ok: true; challenges: Challenge[] }>("/api/challenges")
      .then((j) => j.challenges.find((c) => c.id === challengeId) ?? null)
      .then(setChallenge)
      .catch((e) => setErr(String(e?.message || e)));
  }, [challengeId]);

  function switchLang(l: Lang) {
    setLang(l);
    setCode(l.starter);
  }

  async function startAttempt() {
    setErr(null);
    try {
      const j = await apiPost<{ ok: true; attempt: Attempt }>("/api/attempts", { challengeId });
      setAttempt(j.attempt);
    } catch (e: any) { setErr(String(e?.message || e)); }
  }

  async function logWorkflow(type: "prompt" | "iteration" | "note") {
    if (!attempt || !workflowNote.trim()) return;
    try {
      await apiPost("/api/attempts/events", { attemptId: attempt.id, type, text: workflowNote.trim() });
      setEvents((ev) => [...ev, { type, text: workflowNote.trim() }]);
      setNote("");
    } catch (e: any) { setErr(String(e?.message || e)); }
  }

  async function submit() {
    if (!attempt) return;
    try {
      await apiPost("/api/attempts/submit", { attemptId: attempt.id, submissionUrl });
      setAttempt({ ...attempt, status: "SUBMITTED", submissionUrl });
    } catch (e: any) { setErr(String(e?.message || e)); }
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
            if (event === "log")  setEvalLogs((l) => [...l, data.message]);
            if (event === "score") setScore(data);
            if (event === "done") setAttempt((a) => a ? { ...a, status: "EVALUATED" } : a);
          }
        }
      }
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setEvaluating(false); }
  }

  async function runCode() {
    if (!lang.runnable) return;
    setErr(null); setRunLogs([]); setRunResult(null);
    try {
      const j = await apiPost<{ ok: true; runId: string }>("/api/run", {
        language: "python", entry: `main.${lang.ext}`,
        timeoutMs: 10000, files: [{ path: `main.${lang.ext}`, content: code }]
      });
      setRunId(j.runId);
      esRef.current?.close();
      const es = new EventSource(`${API_BASE}/api/run/${j.runId}/stream`);
      esRef.current = es;
      es.addEventListener("log",  (ev: any) => { const d = JSON.parse(ev.data); setRunLogs((l) => [...l, d.line]); });
      es.addEventListener("done", (ev: any) => { setRunResult(JSON.parse(ev.data)); es.close(); });
      es.onerror = () => { setRunLogs((l) => [...l, "[SSE error]"]); es.close(); };
    } catch (e: any) { setErr(String(e?.message || e)); }
  }

  useEffect(() => () => { esRef.current?.close(); }, []);

  async function getToken() {
    try { const r = await fetch("/api/api-token", { cache: "no-store" }); return (await r.json())?.token ?? null; }
    catch { return null; }
  }

  const diffColors = ["", "var(--green)", "var(--green)", "var(--yellow)", "var(--red)", "var(--purple)"];
  const diffLabels = ["", "Easy", "Easy+", "Medium", "Hard", "Expert"];
  const d = challenge?.difficulty ?? 0;
  const diffColor = diffColors[d] ?? "var(--text-3)";
  const diffLabel = diffLabels[d] ?? "";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 14, height: "calc(100vh - 110px)" }}>

      {/* ── Left: problem + workflow ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", paddingRight: 2 }}>

        {/* Problem */}
        <div className="card" style={{ padding: 18, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>{challenge?.title ?? "Loading…"}</div>
            {diffLabel && (
              <span style={{ fontSize: 12, fontWeight: 600, color: diffColor, background: `${diffColor}18`, padding: "3px 8px", borderRadius: 999, border: `1px solid ${diffColor}40`, whiteSpace: "nowrap" }}>
                {diffLabel}
              </span>
            )}
          </div>
          <div style={{ color: "var(--text-2)", marginTop: 6, fontSize: 13 }}>{challenge?.description}</div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}>
            <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>Problem Statement</div>
            <div style={{ whiteSpace: "pre-wrap", color: "var(--text-1)", lineHeight: 1.7, fontSize: 13 }}>{challenge?.prompt}</div>
          </div>

          {challenge?.rubric && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.05)" }}>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--purple)", marginBottom: 8 }}>Rubric</div>
              {Object.entries(challenge.rubric).map(([k, v]: any) => (
                <div key={k} style={{ marginBottom: 5, fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-2)", textTransform: "capitalize" }}>{k}: </span>
                  <span style={{ color: "var(--text-2)" }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
            {!attempt ? (
              <button className="btn" onClick={startAttempt}>Start Attempt</button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: attempt.status === "EVALUATED" ? "var(--green)" : attempt.status === "SUBMITTED" ? "var(--yellow)" : "var(--blue)", display: "inline-block" }} />
                <span style={{ color: "var(--text-2)" }}>{attempt.status}</span>
                <span style={{ color: "var(--text-3)" }}>· {attempt.id.slice(0, 8)}…</span>
              </div>
            )}
          </div>
        </div>

        {/* Workflow log */}
        <div className="card" style={{ padding: 18, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)" }}>Workflow Log</div>
          <textarea className="textarea" rows={4}
            placeholder="Paste your AI prompt, note an iteration, or describe your debugging step…"
            value={workflowNote} onChange={(e) => setNote(e.target.value)} disabled={!attempt} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn sm" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("prompt")}>Log Prompt</button>
            <button className="btn sm secondary" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("iteration")}>Iteration</button>
            <button className="btn sm secondary" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("note")}>Note</button>
          </div>
          {loggedEvents.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflowY: "auto" }}>
              {loggedEvents.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, background: "var(--bg)", padding: "5px 9px", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <span style={{ color: ev.type === "prompt" ? "var(--blue)" : ev.type === "iteration" ? "var(--green)" : "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 50 }}>{ev.type}</span>
                  <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="card" style={{ padding: 18, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)" }}>Submit</div>
          <input className="input" placeholder="GitHub repo or PR URL (optional)" value={submissionUrl} onChange={(e) => setUrl(e.target.value)} disabled={!attempt} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" disabled={!attempt || attempt.status === "EVALUATED"} onClick={submit}>Submit</button>
            <button className="btn secondary" disabled={!attempt || evaluating} onClick={evaluate}>{evaluating ? "Evaluating…" : "Get AI Score"}</button>
          </div>
          {err && <div style={{ color: "var(--red)", marginTop: 8, fontSize: 12 }}>{err}</div>}
        </div>
      </div>

      {/* ── Right: editor / score ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden", minHeight: 0 }}>

        {/* Language selector bar */}
        <div className="card" style={{ padding: "10px 14px", flexShrink: 0 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", marginRight: 10 }}>Language</span>
            {!lang.runnable && (
              <span style={{ fontSize: 11, color: "var(--yellow)", background: "var(--yellow-dim)", padding: "1px 7px", borderRadius: 999, border: "1px solid rgba(245,158,11,0.25)" }}>
                Execution: Python only for now
              </span>
            )}
          </div>
          <LangSelector selected={lang} onChange={switchLang} />
        </div>

        {/* Tab bar */}
        <div className="card" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {(["editor", "workflow", "score"] as const).map((t) => (
            <button key={t} className={`btn sm ${activeTab === t ? "" : "ghost"}`} onClick={() => setActiveTab(t)}>
              {t === "editor" ? "⌨ Editor" : t === "workflow" ? "📋 Events" : "📊 Score"}
              {t === "score" && score ? ` · ${score.total}` : ""}
            </button>
          ))}
          {activeTab === "editor" && (
            <button
              className="btn sm secondary"
              style={{ marginLeft: "auto" }}
              onClick={runCode}
              disabled={!lang.runnable}
              title={lang.runnable ? "Run code" : "Execution only available for Python"}
            >
              ▶ Run {lang.icon}
            </button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "editor" && (
          <>
            <div className="card" style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
              <MonacoEditor
                height="100%"
                language={lang.id}
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false, padding: { top: 12 } }}
              />
            </div>
            {/* Console */}
            <div className="card" style={{ padding: 12, maxHeight: 160, overflow: "auto", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)" }}>Console</div>
                {runId && <div className="mono" style={{ fontSize: 10, color: "var(--text-3)" }}>{runId}</div>}
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                {runLogs.length ? runLogs.map((l, i) => <div key={i}>{l}</div>) : (
                  <div style={{ color: "var(--text-3)" }}>
                    {lang.runnable ? "No output yet. Click ▶ Run." : `Execution not available for ${lang.label} yet — submit your repo URL above.`}
                  </div>
                )}
              </div>
              {runResult && (
                <div style={{ marginTop: 6, fontSize: 12, color: runResult.status === "done" ? "var(--green)" : "var(--red)" }}>
                  [{runResult.status}]{runResult.error ? ` ${runResult.error}` : ""}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "workflow" && (
          <div className="card" style={{ padding: 18, flex: 1, overflow: "auto", minHeight: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Logged Events ({loggedEvents.length})</div>
            {loggedEvents.length === 0 ? (
              <div style={{ color: "var(--text-3)" }}>No events yet. Start an attempt and use the workflow log.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loggedEvents.map((ev, i) => (
                  <div key={i} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ color: ev.type === "prompt" ? "var(--blue)" : ev.type === "iteration" ? "var(--green)" : "var(--text-3)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{ev.type}</span>
                      <span style={{ color: "var(--text-3)", fontSize: 11 }}>#{i + 1}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{ev.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "score" && (
          <div className="card" style={{ padding: 20, flex: 1, overflow: "auto", minHeight: 0 }}>
            {evaluating && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>Evaluating…</div>
                {evalLogs.map((l, i) => <div key={i} style={{ fontSize: 13, color: "var(--text-2)" }}>› {l}</div>)}
              </div>
            )}
            {!evaluating && score && <ScorePanel score={score} />}
            {!evaluating && !score && (
              <div style={{ color: "var(--text-3)", textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <div>Start an attempt, log prompts, then click <strong>Get AI Score</strong>.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
