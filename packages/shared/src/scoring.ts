import type { PromptEventType } from "./schemas.js";

export type ScoreBreakdown = {
  promptQuality: number; // 0..100
  iterationIntelligence: number; // 0..100
  efficiency: number; // 0..100
  correctnessProxy: number; // 0..100
  total: number; // 0..100
  notes: string[];
};

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

// MVP heuristic scoring (cheap + deterministic). LLM rubric can be layered later.
export function scoreAttemptHeuristic(params: {
  startedAt: number;
  endedAt: number;
  events: { type: PromptEventType; text: string; createdAt: number }[];
  hasSubmission: boolean;
}): ScoreBreakdown {
  const { startedAt, endedAt, events, hasSubmission } = params;
  const durationMs = Math.max(0, endedAt - startedAt);
  const durationMin = durationMs / 60_000;

  const prompts = events.filter((e) => e.type === "prompt");
  const iterations = events.filter((e) => e.type === "iteration");

  // Prompt quality proxy: prefer fewer, structured prompts with enough context.
  const avgPromptLen = prompts.length ? prompts.reduce((s, e) => s + e.text.length, 0) / prompts.length : 0;
  const promptQuality = clamp(
    40 + Math.log10(Math.max(10, avgPromptLen)) * 20 - Math.max(0, prompts.length - 6) * 4
  );

  // Iteration intelligence proxy: having iterations is good, too many is bad.
  const iterationIntelligence = clamp(55 + Math.min(iterations.length, 6) * 6 - Math.max(0, iterations.length - 10) * 5);

  // Efficiency proxy: faster is better up to a floor; extremely fast can be suspicious.
  const efficiency = clamp(80 - Math.max(0, durationMin - 25) * 1.2 - Math.max(0, 8 - durationMin) * 0.8);

  // Correctness proxy: until we have sandboxed tests, use a conservative proxy.
  const correctnessProxy = clamp(hasSubmission ? 55 : 10);

  const total = clamp(0.35 * promptQuality + 0.25 * iterationIntelligence + 0.2 * efficiency + 0.2 * correctnessProxy);
  const notes: string[] = [];
  if (!hasSubmission) notes.push("No submission URL provided; correctness not evaluable.");
  if (prompts.length === 0) notes.push("No prompts logged.");

  return {
    promptQuality: Math.round(promptQuality),
    iterationIntelligence: Math.round(iterationIntelligence),
    efficiency: Math.round(efficiency),
    correctnessProxy: Math.round(correctnessProxy),
    total: Math.round(total),
    notes
  };
}

