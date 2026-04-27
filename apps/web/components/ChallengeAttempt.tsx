"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, API_BASE } from "./api";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Challenge = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  difficulty: number;
  rubric?: any;
};

type Attempt = { id: string; challengeId: string; status: string; submissionUrl?: string | null };

type ScoreBreakdown = {
  promptQuality: number;
  iterationIntelligence: number;
  efficiency: number;
  correctnessProxy: number;
  total: number;
  notes: string[];
};

function scoreColor(n: number) {
  if (n >= 75) return "var(--green)";
  if (n >= 50) return "var(--yellow)";
  return "var(--red)";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: "var(--text-2)" }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function ScorePanel({ score }: { score: ScoreBreakdown }) {
  const color = scoreColor(score.total);
  return (
    <div className="card" style={{ padding: 18, border: `1px solid ${color}40` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          border: `3px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0
        }}>
          <div style={{ fontSize: 24, fontWeight: 900, color }}>{score.total}</div>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>AI Skill Score</div>
          <div style={{ color: "var(--text-2)", fontSize: 12, marginTop: 2 }}>
            {score.total >= 75 ? "Great AI workflow" : score.total >= 50 ? "Solid attempt" : "Needs improvement"}
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
        <div style={{ marginTop: 14, padding: 10, borderRadius: 8, background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
          {score.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--yellow)", lineHeight: 1.5 }}>⚠ {n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChallengeAttempt({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [workflowNote, setWorkflowNote] = useState("");
  const [loggedEvents, setLoggedEvents] = useState<{ type: string; text: string }[]>([]);

  const [code, setCode] = useState("# Write your solution here\n\nprint('hello bitcode')\n");
  const [runId, setRunId] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<any | null>(null);

  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [evalLogs, setEvalLogs] = useState<string[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"editor" | "workflow" | "score">("editor");

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    apiGet<{ ok: true; challenges: Challenge[] }>("/api/challenges")
      .then((j) => j.challenges.find((c) => c.id === challengeId) ?? null)
      .then(setChallenge)
      .catch((e) => setErr(String(e?.message || e)));
  }, [challengeId]);

  async function startAttempt() {
    setErr(null);
    try {
      const j = await apiPost<{ ok: true; attempt: Attempt }>("/api/attempts", { challengeId });
      setAttempt(j.attempt);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function logWorkflow(type: "prompt" | "iteration" | "note") {
    if (!attempt || !workflowNote.trim()) return;
    try {
      await apiPost("/api/attempts/events", { attemptId: attempt.id, type, text: workflowNote.trim() });
      setLoggedEvents((ev) => [...ev, { type, text: workflowNote.trim() }]);
      setWorkflowNote("");
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function submit() {
    if (!attempt) return;
    try {
      await apiPost("/api/attempts/submit", { attemptId: attempt.id, submissionUrl });
      setAttempt({ ...attempt, status: "SUBMITTED", submissionUrl });
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function evaluate() {
    if (!attempt) return;
    setEvaluating(true);
    setScore(null);
    setEvalLogs([]);
    setActiveTab("score");

    const token = await getToken();
    const url = `${API_BASE}/api/attempts/${attempt.id}/evaluate/stream`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const resp = await fetch(url, { headers });
      const reader = resp.body?.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        let event = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (event === "log") setEvalLogs((l) => [...l, data.message]);
            if (event === "score") setScore(data);
            if (event === "done") {
              setAttempt((a) => (a ? { ...a, status: "EVALUATED" } : a));
            }
          }
        }
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setEvaluating(false);
    }
  }

  async function getToken(): Promise<string | null> {
    try {
      const r = await fetch("/api/api-token", { cache: "no-store" });
      const j = await r.json();
      return j?.token ?? null;
    } catch { return null; }
  }

  async function runCode() {
    setErr(null);
    setRunLogs([]);
    setRunResult(null);
    try {
      const j = await apiPost<{ ok: true; runId: string }>("/api/run", {
        language: "python",
        entry: "main.py",
        timeoutMs: 10000,
        files: [{ path: "main.py", content: code }]
      });
      setRunId(j.runId);

      esRef.current?.close();
      const es = new EventSource(`${API_BASE}/api/run/${j.runId}/stream`);
      esRef.current = es;
      es.addEventListener("log", (ev: any) => {
        const d = JSON.parse(ev.data);
        setRunLogs((l) => [...l, d.line]);
      });
      es.addEventListener("done", (ev: any) => {
        const d = JSON.parse(ev.data);
        setRunResult(d);
        es.close();
      });
      es.onerror = () => {
        setRunLogs((l) => [...l, "[SSE error]"]);
        es.close();
      };
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => () => { esRef.current?.close(); }, []);

  const diffLabel = ["", "Easy", "Easy+", "Medium", "Hard", "Expert"][challenge?.difficulty ?? 0] ?? "";
  const diffColor = [, "var(--green)", "var(--green)", "var(--yellow)", "var(--red)", "var(--purple)"][challenge?.difficulty ?? 0] ?? "var(--text-3)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 14, height: "calc(100vh - 80px)" }}>

      {/* ── Left panel: problem + workflow ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, overflow: "auto" }}>
        {/* Problem card */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }}>{challenge?.title ?? "Loading…"}</div>
            <span style={{ fontSize: 12, fontWeight: 600, color: diffColor, background: `${diffColor}18`, padding: "3px 8px", borderRadius: 999, border: `1px solid ${diffColor}40`, whiteSpace: "nowrap" }}>{diffLabel}</span>
          </div>
          <div style={{ color: "var(--text-2)", marginTop: 6, fontSize: 13 }}>{challenge?.description}</div>

          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)" }}>
            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>Problem Statement</div>
            <div style={{ whiteSpace: "pre-wrap", color: "var(--text-1)", lineHeight: 1.7, fontSize: 13 }}>{challenge?.prompt}</div>
          </div>

          {challenge?.rubric && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.05)" }}>
              <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--purple)", marginBottom: 8 }}>Rubric</div>
              {Object.entries(challenge.rubric).map(([k, v]: any) => (
                <div key={k} style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "var(--text-2)", textTransform: "capitalize" }}>{k}:</span>
                  <span style={{ fontSize: 12, color: "var(--text-2)", marginLeft: 6 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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

        {/* Workflow log card */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-3)" }}>Workflow Log</div>
          <textarea
            className="textarea"
            rows={5}
            placeholder="Paste your AI prompt, note an iteration, or describe your debugging step…"
            value={workflowNote}
            onChange={(e) => setWorkflowNote(e.target.value)}
            disabled={!attempt}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn sm" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("prompt")}>Log Prompt</button>
            <button className="btn sm secondary" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("iteration")}>Log Iteration</button>
            <button className="btn sm secondary" disabled={!attempt || !workflowNote.trim()} onClick={() => logWorkflow("note")}>Log Note</button>
          </div>

          {loggedEvents.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
              {loggedEvents.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, background: "var(--bg)", padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <span style={{ color: ev.type === "prompt" ? "var(--blue)" : ev.type === "iteration" ? "var(--green)" : "var(--text-3)", fontWeight: 600, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.06em", minWidth: 54 }}>{ev.type}</span>
                  <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit card */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-3)" }}>Submit</div>
          <input
            className="input"
            placeholder="GitHub repo or PR URL (optional)"
            value={submissionUrl}
            onChange={(e) => setSubmissionUrl(e.target.value)}
            disabled={!attempt}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="btn"
              disabled={!attempt || attempt.status === "EVALUATED"}
              onClick={submit}
            >
              Submit
            </button>
            <button
              className="btn secondary"
              disabled={!attempt || evaluating}
              onClick={evaluate}
            >
              {evaluating ? "Evaluating…" : "Get AI Score"}
            </button>
          </div>
          {err ? <div style={{ color: "var(--red)", marginTop: 10, fontSize: 13 }}>{err}</div> : null}
        </div>
      </div>

      {/* ── Right panel: editor / score ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
        {/* Tab bar */}
        <div className="card" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          {(["editor", "workflow", "score"] as const).map((t) => (
            <button
              key={t}
              className={`btn sm ${activeTab === t ? "" : "ghost"}`}
              onClick={() => setActiveTab(t)}
            >
              {t === "editor" ? "⌨ Editor" : t === "workflow" ? "📋 Events" : "📊 Score"}
              {t === "score" && score ? ` · ${score.total}` : ""}
            </button>
          ))}
          {activeTab === "editor" && (
            <button className="btn sm secondary" style={{ marginLeft: "auto" }} onClick={runCode}>▶ Run</button>
          )}
        </div>

        {/* Tab content */}
        {activeTab === "editor" && (
          <>
            <div className="card" style={{ flex: 1, overflow: "hidden" }}>
              <MonacoEditor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false, padding: { top: 12 } }}
              />
            </div>
            {/* Console */}
            <div className="card" style={{ padding: 12, maxHeight: 180, overflow: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)" }}>Console</div>
                {runId && <div style={{ fontSize: 11, color: "var(--text-3)" }} className="mono">{runId}</div>}
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                {runLogs.length ? runLogs.map((l, i) => <div key={i}>{l}</div>) : <div style={{ color: "var(--text-3)" }}>No output yet. Click Run.</div>}
              </div>
              {runResult && (
                <div style={{ marginTop: 8, fontSize: 12, color: runResult.status === "done" ? "var(--green)" : "var(--red)" }}>
                  [{runResult.status}] {runResult.error ? runResult.error : ""}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "workflow" && (
          <div className="card" style={{ padding: 18, flex: 1, overflow: "auto" }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 13 }}>Logged Events</div>
            {loggedEvents.length === 0 ? (
              <div style={{ color: "var(--text-3)" }}>No events logged yet. Start an attempt and use the Workflow Log.</div>
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
          <div className="card" style={{ padding: 18, flex: 1, overflow: "auto" }}>
            {evaluating && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Evaluating…</div>
                {evalLogs.map((l, i) => (
                  <div key={i} style={{ fontSize: 13, color: "var(--text-2)" }}>› {l}</div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)", opacity: 0.5 + i * 0.15 }} />
                  ))}
                </div>
              </div>
            )}
            {!evaluating && score && <ScorePanel score={score} />}
            {!evaluating && !score && (
              <div style={{ color: "var(--text-3)", textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div>Start an attempt, log prompts, then click <strong>Get AI Score</strong>.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
