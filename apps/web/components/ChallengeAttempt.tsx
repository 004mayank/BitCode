"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "./api";

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
  const [eventText, setEventText] = useState<string>("");
  const [submissionUrl, setSubmissionUrl] = useState<string>("");
  const [score, setScore] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

  async function logPrompt(type: string) {
    if (!attempt) return;
    if (!eventText.trim()) return;
    await apiPost("/api/attempts/events", { attemptId: attempt.id, type, text: eventText.trim() });
    setEventText("");
  }

  async function submit() {
    if (!attempt) return;
    await apiPost("/api/attempts/submit", { attemptId: attempt.id, submissionUrl });
    setAttempt({ ...attempt, status: "SUBMITTED", submissionUrl });
  }

  async function evaluate() {
    if (!attempt) return;
    setLogs([]);
    setScore(null);
    const es = new EventSource(`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}/api/attempts/${attempt.id}/evaluate/stream`);
    es.addEventListener("log", (ev: any) => {
      const data = JSON.parse(ev.data);
      setLogs((l) => [...l, data.message]);
    });
    es.addEventListener("score", (ev: any) => {
      setScore(JSON.parse(ev.data));
    });
    es.addEventListener("done", () => {
      es.close();
    });
    es.onerror = () => {
      setLogs((l) => [...l, "SSE connection error"]);
      es.close();
    };
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 14 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{challenge?.title ?? "Challenge"}</div>
        <div style={{ color: "#94a3b8", marginTop: 6 }}>{challenge?.description}</div>
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.18)", background: "#0b1220" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Problem statement</div>
          <div style={{ whiteSpace: "pre-wrap", color: "#cbd5e1" }}>{challenge?.prompt}</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
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
            placeholder="Paste your prompt / reasoning / iteration notes here…"
            value={eventText}
            onChange={(e) => setEventText(e.target.value)}
            disabled={!attempt}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn secondary" disabled={!attempt} onClick={() => logPrompt("prompt")}>
              Log prompt
            </button>
            <button className="btn secondary" disabled={!attempt} onClick={() => logPrompt("iteration")}>
              Log iteration
            </button>
            <button className="btn secondary" disabled={!attempt} onClick={() => logPrompt("note")}>
              Log note
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Submission</div>
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
            <button className="btn secondary" disabled={!canEval} onClick={evaluate}>
              Evaluate (SSE)
            </button>
          </div>
        </div>

        {err ? <div style={{ color: "#fca5a5", marginTop: 12 }}>{err}</div> : null}
      </div>

      <div style={{ display: "grid", gridTemplateRows: "auto auto", gap: 14 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Evaluation logs</div>
          <div style={{ marginTop: 10, fontFamily: "ui-monospace", fontSize: 12, color: "#cbd5e1" }}>
            {logs.length ? logs.map((l, i) => <div key={i}>• {l}</div>) : <div style={{ color: "#64748b" }}>No logs yet.</div>}
          </div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Score</div>
          {score ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 34, fontWeight: 900 }}>{score.total}</div>
              <div style={{ color: "#94a3b8" }}>AI Skill Score (heuristic MVP)</div>
              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                <div>Prompt Quality: {score.promptQuality}</div>
                <div>Iteration Intelligence: {score.iterationIntelligence}</div>
                <div>Efficiency: {score.efficiency}</div>
                <div>Correctness proxy: {score.correctnessProxy}</div>
              </div>
              {score.notes?.length ? (
                <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 13 }}>
                  Notes: {score.notes.join(" ")}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 10, color: "#64748b" }}>No score yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

