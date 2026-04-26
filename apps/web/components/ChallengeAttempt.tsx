"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, API_BASE } from "./api";

// Monaco via dynamic import to keep Next dev happy.
import dynamic from "next/dynamic";
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Challenge = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  difficulty: number;
};

type Attempt = { id: string; challengeId: string; status: string; submissionUrl?: string | null };

export function ChallengeAttempt({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState<string>("");
  const [workflowNote, setWorkflowNote] = useState<string>("");

  const [code, setCode] = useState<string>(
    "# Write your solution here\n\nprint('hello bitcode')\n"
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<string[]>([]);
  const [runResult, setRunResult] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);

  const canEval = useMemo(() => Boolean(attempt?.id), [attempt?.id]);

  useEffect(() => {
    apiGet<{ ok: true; challenges: Challenge[] }>("/api/challenges")
      .then((j) => j.challenges.find((c) => c.id === challengeId) || null)
      .then((c) => setChallenge(c))
      .catch((e) => setErr(String(e?.message || e)));
  }, [challengeId]);

  async function startAttempt() {
    setErr(null);
    const j = await apiPost<{ ok: true; attempt: Attempt }>("/api/attempts", { challengeId });
    setAttempt(j.attempt);
  }

  async function logWorkflow(type: "prompt" | "iteration" | "note") {
    if (!attempt) return;
    if (!workflowNote.trim()) return;
    await apiPost("/api/attempts/events", { attemptId: attempt.id, type, text: workflowNote.trim() });
    setWorkflowNote("");
  }

  async function submit() {
    if (!attempt) return;
    await apiPost("/api/attempts/submit", { attemptId: attempt.id, submissionUrl });
    setAttempt({ ...attempt, status: "SUBMITTED", submissionUrl });
  }

  async function runCode() {
    setErr(null);
    setRunLogs([]);
    setRunResult(null);
    const j = await apiPost<{ ok: true; runId: string }>("/api/run", {
      language: "python",
      entry: "main.py",
      timeoutMs: 10000,
      files: [{ path: "main.py", content: code }]
    });
    setRunId(j.runId);

    // Stream logs
    esRef.current?.close();
    const es = new EventSource(`${API_BASE}/api/run/${j.runId}/stream`);
    esRef.current = es;
    es.addEventListener("log", (ev: any) => {
      const data = JSON.parse(ev.data);
      setRunLogs((l) => [...l, data.line]);
    });
    es.addEventListener("done", (ev: any) => {
      const data = JSON.parse(ev.data);
      setRunResult(data);
      es.close();
    });
    es.onerror = () => {
      setRunLogs((l) => [...l, "SSE error"]);
      es.close();
    };
  }

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 12, height: "calc(100vh - 120px)" }}>
      {/* Left: statement */}
      <div className="card" style={{ padding: 14, overflow: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{challenge?.title ?? "Challenge"}</div>
        <div style={{ color: "#94a3b8", marginTop: 6 }}>{challenge?.description}</div>
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Problem</div>
          <div style={{ whiteSpace: "pre-wrap", color: "#cbd5e1", lineHeight: 1.5 }}>{challenge?.prompt}</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          {!attempt ? (
            <button className="btn" onClick={startAttempt}>
              Start attempt
            </button>
          ) : (
            <div style={{ color: "#93c5fd" }}>Attempt: {attempt.id.slice(0, 10)}… ({attempt.status})</div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Workflow log</div>
          <textarea
            className="textarea"
            rows={6}
            placeholder="Paste prompts/notes/iterations…"
            value={workflowNote}
            onChange={(e) => setWorkflowNote(e.target.value)}
            disabled={!attempt}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn secondary" disabled={!attempt} onClick={() => logWorkflow("prompt")}>
              Log prompt
            </button>
            <button className="btn secondary" disabled={!attempt} onClick={() => logWorkflow("iteration")}>
              Log iteration
            </button>
            <button className="btn secondary" disabled={!attempt} onClick={() => logWorkflow("note")}>
              Log note
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Submission URL (optional)</div>
          <input
            className="input"
            placeholder="GitHub repo/PR URL"
            value={submissionUrl}
            onChange={(e) => setSubmissionUrl(e.target.value)}
            disabled={!attempt}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" disabled={!attempt || !submissionUrl} onClick={submit}>
              Submit
            </button>
            <button className="btn secondary" disabled={!canEval} onClick={() => {}}>
              Evaluate (existing)
            </button>
          </div>
        </div>

        {err ? <div style={{ color: "#fca5a5", marginTop: 12 }}>{err}</div> : null}
      </div>

      {/* Right: editor + console */}
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", gap: 10, height: "100%" }}>
        <div className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>Editor</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Python</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn secondary" onClick={runCode}>
              Run
            </button>
          </div>
        </div>

        <div className="card" style={{ overflow: "hidden" }}>
          <MonacoEditor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(v) => setCode(v || "")}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              scrollBeyondLastLine: false
            }}
          />
        </div>

        <div className="card" style={{ padding: 12, maxHeight: 220, overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>Console</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{runId ? `runId: ${runId}` : ""}</div>
          </div>
          <div style={{ marginTop: 10, fontFamily: "ui-monospace", fontSize: 12, color: "#cbd5e1" }}>
            {runLogs.length ? runLogs.map((l, i) => <div key={i}>{l}</div>) : <div style={{ color: "#64748b" }}>No output yet.</div>}
          </div>
          {runResult ? (
            <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12 }}>
              status: {runResult.status} {runResult.error ? `· ${runResult.error}` : ""}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

