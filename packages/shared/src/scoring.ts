import type { PromptEventType } from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** One scored dimension (0–100) with its weight in the final formula. */
export type DimensionScore = {
  score: number;     // 0–100
  weight: number;    // fractional weight (sums to 1.0 across all dims)
  notes: string[];   // human-readable reasoning bullets
};

/** Full score breakdown matching the 5 dimensions shown in the About page. */
export type ScoreBreakdown = {
  // Dimensions
  promptQuality:        DimensionScore; // 20 %
  iterationIntelligence: DimensionScore; // 20 %
  validationDebugging:  DimensionScore; // 25 %
  efficiency:           DimensionScore; // 15 %
  outputQuality:        DimensionScore; // 20 %
  // Aggregated
  total:    number;   // 0–100 (weighted sum)
  method:   "heuristic" | "llm" | "llm+heuristic";
  summary?: string;  // one-paragraph narrative (LLM only)
};

/** Raw event shape passed to scoring functions. */
export type ScoringEvent = {
  type:      PromptEventType;
  text:      string;
  createdAt: number; // ms epoch
};

/** Everything a scorer needs to know about an attempt. */
export type AttemptInput = {
  startedAt:     number;         // ms epoch
  endedAt:       number;         // ms epoch
  events:        ScoringEvent[];
  hasSubmission: boolean;
  summary?:      string | null;
  challengePrompt?: string | null;
  challengeRubric?: { correctness?: string; aiUsage?: string } | null;
};

/** Input for scoring a bounty submission. */
export type SubmissionInput = {
  note?:         string | null;
  repoUrl:       string;
  prUrl?:        string | null;
  commitSha?:    string | null;
  bountyTitle:   string;
  bountyDescription: string;
  bountyRequirements?: Record<string, unknown> | null;
  challengePrompt?:    string | null;
  challengeRubric?: { correctness?: string; aiUsage?: string } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

function dim(score: number, weight: number, notes: string[]): DimensionScore {
  return { score: Math.round(clamp(score)), weight, notes };
}

function totalFromDims(d: Omit<ScoreBreakdown, "total" | "method" | "summary">): number {
  return Math.round(clamp(
    d.promptQuality.score        * d.promptQuality.weight +
    d.iterationIntelligence.score * d.iterationIntelligence.weight +
    d.validationDebugging.score  * d.validationDebugging.weight +
    d.efficiency.score           * d.efficiency.weight +
    d.outputQuality.score        * d.outputQuality.weight
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic scorer  (fast, deterministic, no API calls)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * scoreAttemptHeuristic — scores an attempt using signal proxies extracted
 * from prompt event metadata.  Used as a fast baseline and as the fallback
 * when the LLM evaluator is not available.
 *
 * Dimension weights:
 *   Prompt Quality         20 %
 *   Iteration Intelligence 20 %
 *   Validation & Debugging 25 %
 *   Efficiency             15 %
 *   Output Quality         20 %
 */
export function scoreAttemptHeuristic(params: AttemptInput): ScoreBreakdown {
  const { startedAt, endedAt, events, hasSubmission, summary } = params;
  const durationMs  = Math.max(0, endedAt - startedAt);
  const durationMin = durationMs / 60_000;

  const prompts    = events.filter((e) => e.type === "prompt");
  const iterations = events.filter((e) => e.type === "iteration");
  const notes_ev   = events.filter((e) => e.type === "note");
  const extTools   = events.filter((e) => e.type === "external_tool");
  const replies    = events.filter((e) => e.type === "assistant_reply");

  // ── Prompt Quality (20 %) ──────────────────────────────────────────────────
  // Signals: avg prompt length (structured prompts are longer), prompt count
  // (too many scatter-shot prompts vs. a few well-crafted ones), use of
  // context (keywords that indicate constraint specification).
  const avgPromptLen = prompts.length
    ? prompts.reduce((s, e) => s + e.text.length, 0) / prompts.length
    : 0;
  const promptLenScore  = clamp(Math.log10(Math.max(10, avgPromptLen)) * 28 - 10);
  const promptCountPen  = Math.max(0, prompts.length - 8) * 4;
  const contextKeywords = ["requirement", "constraint", "format", "output", "example", "context", "only", "must", "should"];
  const contextBonus    = prompts.some((p) =>
    contextKeywords.some((k) => p.text.toLowerCase().includes(k))
  ) ? 10 : 0;
  const pqScore  = clamp(40 + promptLenScore - promptCountPen + contextBonus);
  const pqNotes: string[] = [];
  if (prompts.length === 0) pqNotes.push("No prompts logged — prompt quality cannot be assessed.");
  if (avgPromptLen < 80)    pqNotes.push("Prompts are very short; structured constraints improve quality.");
  if (prompts.length > 10)  pqNotes.push("High prompt count; consider fewer, more precise prompts.");
  if (contextBonus)         pqNotes.push("Good use of constraints/context in prompts.");

  // ── Iteration Intelligence (20 %) ─────────────────────────────────────────
  // Signals: iteration count (sweet spot 3–8), notes (indicate reflection),
  // variety in prompt phrasing across iterations (proxy: std-dev of lengths).
  const iterCount      = iterations.length;
  const iterBase       = 45 + Math.min(iterCount, 7) * 7 - Math.max(0, iterCount - 9) * 5;
  const reflectBonus   = Math.min(notes_ev.length, 3) * 5;
  const replyBonus     = replies.length > 0 ? 5 : 0;
  const iiScore        = clamp(iterBase + reflectBonus + replyBonus);
  const iiNotes: string[] = [];
  if (iterCount === 0)       iiNotes.push("No iterations logged; iterative refinement raises scores.");
  if (iterCount > 12)        iiNotes.push("Many iterations logged; signal quality matters more than count.");
  if (notes_ev.length > 0)   iiNotes.push(`${notes_ev.length} note(s) logged — good reflection practice.`);

  // ── Validation & Debugging (25 %) ─────────────────────────────────────────
  // Signals: external tool use (testing frameworks, linters), notes that
  // mention test/error/fix/edge/validate, submission summary mentions testing.
  const testKeywords  = ["test", "error", "debug", "fix", "edge", "valid", "assert", "check", "fail", "pass", "unit", "expect"];
  const toolTestBonus = Math.min(extTools.length, 4) * 8;
  const noteTestBonus = notes_ev.filter((n) =>
    testKeywords.some((k) => n.text.toLowerCase().includes(k))
  ).length * 6;
  const summaryTestBonus = summary &&
    testKeywords.some((k) => summary.toLowerCase().includes(k)) ? 8 : 0;
  const promptTestBonus  = prompts.filter((p) =>
    testKeywords.some((k) => p.text.toLowerCase().includes(k))
  ).length * 4;
  const vdScore = clamp(35 + toolTestBonus + noteTestBonus + summaryTestBonus + promptTestBonus);
  const vdNotes: string[] = [];
  if (extTools.length === 0 && noteTestBonus === 0) vdNotes.push("No testing or validation signals found in workflow.");
  if (extTools.length > 0)  vdNotes.push(`${extTools.length} external tool call(s) logged (testing/linting).`);
  if (noteTestBonus > 0)    vdNotes.push("Debugging/validation referenced in notes.");

  // ── Efficiency (15 %) ─────────────────────────────────────────────────────
  // Signals: duration (5–30 min sweet spot), event density (actions per
  // minute — very sparse = low engagement, very dense = thrashing).
  const targetMin   = 20;
  const durationPen = Math.abs(durationMin - targetMin) * 0.9;
  const tooFastPen  = durationMin < 3 && durationMin > 0 ? 20 : 0;
  const totalEvents = events.length;
  const density     = totalEvents / Math.max(1, durationMin);
  const densityBonus = clamp(density * 3, 0, 10);
  const effScore    = clamp(85 - durationPen - tooFastPen + densityBonus);
  const effNotes: string[] = [];
  if (durationMin < 3 && durationMin > 0) effNotes.push("Solution completed very quickly — may indicate shallow engagement.");
  if (durationMin > 45)                   effNotes.push("Took a long time; efficiency matters alongside correctness.");
  if (durationMin > 0)                    effNotes.push(`Total time: ${Math.round(durationMin)} min with ${totalEvents} logged events.`);

  // ── Output Quality (20 %) ─────────────────────────────────────────────────
  // Signals: has submission URL, summary length and content quality, rubric
  // keywords present in summary.
  const rubricKeywords  = ["implement", "return", "output", "result", "solution", "function", "class", "api", "endpoint"];
  const summaryLen      = summary?.length ?? 0;
  const summaryScore    = clamp(Math.log10(Math.max(10, summaryLen)) * 25 - 5);
  const rubricBonus     = summary &&
    rubricKeywords.some((k) => summary.toLowerCase().includes(k)) ? 8 : 0;
  const submissionBonus = hasSubmission ? 20 : 0;
  const oqScore         = clamp(submissionBonus + summaryScore + rubricBonus);
  const oqNotes: string[] = [];
  if (!hasSubmission) oqNotes.push("No submission URL provided; output quality cannot be verified.");
  if (summaryLen < 50 && hasSubmission) oqNotes.push("Short summary; a detailed description improves output score.");
  if (rubricBonus)    oqNotes.push("Summary mentions solution artefacts.");

  const dims = {
    promptQuality:         dim(pqScore,  0.20, pqNotes),
    iterationIntelligence: dim(iiScore,  0.20, iiNotes),
    validationDebugging:   dim(vdScore,  0.25, vdNotes),
    efficiency:            dim(effScore, 0.15, effNotes),
    outputQuality:         dim(oqScore,  0.20, oqNotes),
  };

  return { ...dims, total: totalFromDims(dims), method: "heuristic" };
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM score merger
// Merges an LLM score response (raw dimension scores) with a heuristic
// baseline — LLM scores take priority; efficiency always uses heuristic
// (it's time-based and the LLM doesn't have reliable duration info).
// ─────────────────────────────────────────────────────────────────────────────

export type LLMDimensionRaw = {
  score: number;
  notes: string[];
};

export type LLMScoreRaw = {
  promptQuality:         LLMDimensionRaw;
  iterationIntelligence: LLMDimensionRaw;
  validationDebugging:   LLMDimensionRaw;
  outputQuality:         LLMDimensionRaw;
  summary: string;
};

export function mergeLLMWithHeuristic(
  llm:       LLMScoreRaw,
  heuristic: ScoreBreakdown,
): ScoreBreakdown {
  const dims = {
    promptQuality:         dim(llm.promptQuality.score,         0.20, llm.promptQuality.notes),
    iterationIntelligence: dim(llm.iterationIntelligence.score, 0.20, llm.iterationIntelligence.notes),
    validationDebugging:   dim(llm.validationDebugging.score,   0.25, llm.validationDebugging.notes),
    efficiency:            heuristic.efficiency, // always use heuristic for time-based dim
    outputQuality:         dim(llm.outputQuality.score,         0.20, llm.outputQuality.notes),
  };
  return {
    ...dims,
    total:   totalFromDims(dims),
    method:  "llm+heuristic",
    summary: llm.summary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission heuristic scorer  (for bounty submissions)
// ─────────────────────────────────────────────────────────────────────────────

export type SubmissionScoreBreakdown = {
  requirementsCoverage: DimensionScore; // 40 % — does it meet the bounty reqs?
  solutionClarity:      DimensionScore; // 30 % — is the note/PR clear?
  completeness:         DimensionScore; // 30 % — repo URL, PR, SHA, note present?
  total:   number;
  method:  "heuristic" | "llm" | "llm+heuristic";
  summary?: string;
};

export function scoreSubmissionHeuristic(params: SubmissionInput): SubmissionScoreBreakdown {
  const { note, prUrl, commitSha, bountyDescription } = params;

  // Completeness
  let completeness = 20;
  const compNotes: string[] = [];
  if (prUrl)     { completeness += 30; compNotes.push("PR URL provided."); }
  if (commitSha) { completeness += 20; compNotes.push("Commit SHA provided."); }
  if (note)      { completeness += 30; compNotes.push("Submission note provided."); }
  if (!prUrl)    compNotes.push("No PR URL — harder to review.");
  if (!note)     compNotes.push("No submission note — context is important for reviewers.");

  // Solution clarity (based on note quality)
  const noteLen = note?.length ?? 0;
  const clarityScore = clamp(Math.log10(Math.max(10, noteLen)) * 30 - 10);
  const clarNotes: string[] = [];
  if (noteLen < 100) clarNotes.push("Note is brief; detailed explanation improves clarity score.");
  if (noteLen > 300) clarNotes.push("Well-detailed submission note.");

  // Requirements coverage (proxy: keyword overlap between note and bounty desc)
  const reqWords     = bountyDescription.toLowerCase().split(/\W+/).filter((w) => w.length > 5);
  const noteWords    = new Set((note ?? "").toLowerCase().split(/\W+/));
  const overlap      = reqWords.filter((w) => noteWords.has(w)).length;
  const coverageBase = Math.min(60, overlap * 4);
  const reqNotes: string[] = [];
  if (overlap === 0)  reqNotes.push("Note doesn't reference bounty requirements — may miss the mark.");
  if (overlap > 8)    reqNotes.push("Note addresses multiple bounty requirement keywords.");

  const dims = {
    requirementsCoverage: dim(40 + coverageBase, 0.40, reqNotes),
    solutionClarity:      dim(clarityScore,       0.30, clarNotes),
    completeness:         dim(completeness,        0.30, compNotes),
  };

  const total = Math.round(clamp(
    dims.requirementsCoverage.score * dims.requirementsCoverage.weight +
    dims.solutionClarity.score      * dims.solutionClarity.weight +
    dims.completeness.score         * dims.completeness.weight
  ));

  return { ...dims, total, method: "heuristic" };
}
