/**
 * evaluator.ts — LLM-powered scoring engine for BitCode.
 *
 * Two entry points:
 *   evaluateAttempt(input, anthropicKey)   → ScoreBreakdown
 *   evaluateSubmission(input, anthropicKey) → SubmissionScoreBreakdown
 *
 * Both functions fall back to the heuristic scorer if the API key is missing
 * or the LLM call fails.  The `method` field on the returned breakdown tells
 * callers which path was taken.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  scoreAttemptHeuristic,
  scoreSubmissionHeuristic,
  mergeLLMWithHeuristic,
  clamp,
  type AttemptInput,
  type SubmissionInput,
  type ScoreBreakdown,
  type SubmissionScoreBreakdown,
  type LLMScoreRaw,
} from "@bitcode/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

/**
 * Call Claude with a structured JSON response request.
 * Returns the parsed object or throws on failure.
 */
async function callStructured<T>(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const client = makeClient(apiKey);
  const response = await client.messages.create({
    model:      "claude-opus-4-5",
    max_tokens: 1200,
    system:     systemPrompt,
    messages:   [{ role: "user", content: userMessage }],
  });

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as any).text)
    .join("");

  // Extract JSON from code fence or raw
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error(`LLM did not return parseable JSON. Raw:\n${raw.slice(0, 400)}`);
  return JSON.parse(jsonMatch[1]) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attempt evaluator (challenge solving)
// ─────────────────────────────────────────────────────────────────────────────

const ATTEMPT_SYSTEM = `\
You are an expert evaluator for BitCode, an AI-native developer challenge platform.
You will receive a developer's workflow log for a coding challenge and must score it across four dimensions.

Scoring dimensions (each 0–100):

1. **promptQuality** — Did the prompts clearly specify the problem? Did they include context, constraints,
   and examples? Did they guide the AI model effectively vs. vague/scatter-shot queries?

2. **iterationIntelligence** — Did the developer iterate meaningfully? Did each iteration show learning
   from prior outputs? Did they improve based on failures and feedback?

3. **validationDebugging** — Did they detect and fix errors proactively? Did they handle edge cases?
   Did they test and verify their solution, or accept AI output blindly?

4. **outputQuality** — Based on the challenge rubric and solution summary, how correct, complete, and
   production-ready is the final output? Does it actually solve the problem stated in the challenge?

Scoring guidelines:
- 90–100: Exceptional — clear evidence of mastery
- 70–89:  Good — solid practice with minor gaps
- 50–69:  Fair — some good signals but room for improvement
- 30–49:  Below average — minimal effort or poor practices
- 0–29:   Inadequate — little or no meaningful signal

Return ONLY valid JSON (no markdown prose outside the JSON block) in this exact shape:
\`\`\`json
{
  "promptQuality":         { "score": <0-100>, "notes": ["..."] },
  "iterationIntelligence": { "score": <0-100>, "notes": ["..."] },
  "validationDebugging":   { "score": <0-100>, "notes": ["..."] },
  "outputQuality":         { "score": <0-100>, "notes": ["..."] },
  "summary": "<1–2 sentence narrative of overall performance>"
}
\`\`\`
Each "notes" array should have 1–3 concrete, specific observations from the workflow.
Be calibrated and precise — not every attempt deserves a 90.`;

function buildAttemptUserMessage(input: AttemptInput): string {
  const { startedAt, endedAt, events, hasSubmission, summary, challengePrompt, challengeRubric } = input;
  const durationMin = Math.round(Math.max(0, endedAt - startedAt) / 60_000);

  const lines: string[] = [];

  lines.push("## Challenge");
  if (challengePrompt) {
    lines.push(challengePrompt.slice(0, 2000));
  } else {
    lines.push("(no challenge prompt available)");
  }

  if (challengeRubric) {
    lines.push("\n## Evaluation Rubric");
    if (challengeRubric.correctness) lines.push(`Correctness: ${challengeRubric.correctness}`);
    if (challengeRubric.aiUsage)     lines.push(`AI Usage:    ${challengeRubric.aiUsage}`);
  }

  lines.push(`\n## Attempt Metadata`);
  lines.push(`Duration: ${durationMin} minutes`);
  lines.push(`Has submission URL: ${hasSubmission}`);
  lines.push(`Total logged events: ${events.length}`);

  const prompts    = events.filter((e) => e.type === "prompt");
  const iterations = events.filter((e) => e.type === "iteration");
  const noteEvs    = events.filter((e) => e.type === "note");
  const extTools   = events.filter((e) => e.type === "external_tool");

  lines.push(`Prompts: ${prompts.length}, Iterations: ${iterations.length}, Notes: ${noteEvs.length}, Tool calls: ${extTools.length}`);

  if (summary) {
    lines.push("\n## Submission Summary");
    lines.push(summary.slice(0, 1500));
  }

  // Include a condensed event log (last 25 to stay within token limits)
  const relevant = events
    .filter((e) => e.type !== "assistant_reply") // replies can be very long
    .slice(-25);

  if (relevant.length > 0) {
    lines.push("\n## Workflow Log (most recent events)");
    relevant.forEach((e, i) => {
      const ts = new Date(e.createdAt).toISOString().slice(11, 19);
      const excerpt = e.text.slice(0, 300);
      lines.push(`[${ts}] ${e.type.toUpperCase()}: ${excerpt}${e.text.length > 300 ? "…" : ""}`);
    });
  }

  return lines.join("\n");
}

/**
 * Evaluate a challenge attempt.
 * Returns a full ScoreBreakdown.  Falls back to heuristic on LLM error.
 */
export async function evaluateAttempt(
  input:      AttemptInput,
  apiKey?:    string,
): Promise<ScoreBreakdown> {
  const heuristic = scoreAttemptHeuristic(input);

  if (!apiKey) return heuristic;

  try {
    const llmRaw = await callStructured<LLMScoreRaw>(
      apiKey,
      ATTEMPT_SYSTEM,
      buildAttemptUserMessage(input),
    );
    // Validate shape
    const required = ["promptQuality", "iterationIntelligence", "validationDebugging", "outputQuality"];
    for (const key of required) {
      if (typeof (llmRaw as any)[key]?.score !== "number") {
        throw new Error(`LLM response missing/invalid field: ${key}`);
      }
      // Clamp just in case model goes out of range
      (llmRaw as any)[key].score = clamp((llmRaw as any)[key].score);
    }
    return mergeLLMWithHeuristic(llmRaw, heuristic);
  } catch (err) {
    console.error("[evaluator] LLM attempt eval failed, using heuristic:", (err as Error).message);
    return { ...heuristic, method: "heuristic" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission evaluator (bounty submissions)
// ─────────────────────────────────────────────────────────────────────────────

const SUBMISSION_SYSTEM = `\
You are an expert technical reviewer for BitCode, an AI-native developer challenge platform.
You will receive a bounty submission and must score it across three dimensions.

Bounty submissions are evaluated on:

1. **requirementsCoverage** (0–100) — How well does the submission address the bounty requirements?
   Does the note/PR description demonstrate understanding of all stated requirements?
   Are the acceptance criteria clearly met?

2. **solutionClarity** (0–100) — How clearly is the solution explained?
   Is the approach well-documented? Is the reasoning transparent?
   Can a reviewer understand what was built and why?

3. **completeness** (0–100) — Is the submission complete?
   Are all required artefacts present (repo, PR, note)?
   Does it feel production-ready or like a rough draft?

Scoring guidelines:
- 90–100: Exceptional
- 70–89:  Good
- 50–69:  Fair
- 30–49:  Below average
- 0–29:   Inadequate

Return ONLY valid JSON in this exact shape:
\`\`\`json
{
  "requirementsCoverage": { "score": <0-100>, "notes": ["..."] },
  "solutionClarity":      { "score": <0-100>, "notes": ["..."] },
  "completeness":         { "score": <0-100>, "notes": ["..."] },
  "summary": "<1–2 sentence narrative of overall quality>"
}
\`\`\`
Each "notes" array should have 1–3 specific observations. Be calibrated and precise.`;

function buildSubmissionUserMessage(input: SubmissionInput): string {
  const lines: string[] = [];

  lines.push("## Bounty");
  lines.push(`Title: ${input.bountyTitle}`);
  lines.push(`\n${input.bountyDescription.slice(0, 1500)}`);

  if (input.bountyRequirements) {
    lines.push("\n## Bounty Requirements (structured)");
    lines.push(JSON.stringify(input.bountyRequirements, null, 2).slice(0, 800));
  }

  if (input.challengePrompt) {
    lines.push("\n## Underlying Challenge");
    lines.push(input.challengePrompt.slice(0, 1200));
  }

  if (input.challengeRubric) {
    lines.push("\n## Challenge Rubric");
    if (input.challengeRubric.correctness) lines.push(`Correctness: ${input.challengeRubric.correctness}`);
    if (input.challengeRubric.aiUsage)     lines.push(`AI Usage: ${input.challengeRubric.aiUsage}`);
  }

  lines.push("\n## Submission");
  lines.push(`Repo URL:   ${input.repoUrl}`);
  if (input.prUrl)     lines.push(`PR URL:     ${input.prUrl}`);
  if (input.commitSha) lines.push(`Commit:     ${input.commitSha}`);
  if (input.note)      lines.push(`\nNote:\n${input.note.slice(0, 2000)}`);
  else                 lines.push("(no submission note provided)");

  return lines.join("\n");
}

type LLMSubmissionRaw = {
  requirementsCoverage: { score: number; notes: string[] };
  solutionClarity:      { score: number; notes: string[] };
  completeness:         { score: number; notes: string[] };
  summary: string;
};

/**
 * Evaluate a bounty submission.
 * Returns a SubmissionScoreBreakdown.  Falls back to heuristic on LLM error.
 */
export async function evaluateSubmission(
  input:   SubmissionInput,
  apiKey?: string,
): Promise<SubmissionScoreBreakdown> {
  const heuristic = scoreSubmissionHeuristic(input);

  if (!apiKey) return heuristic;

  try {
    const llmRaw = await callStructured<LLMSubmissionRaw>(
      apiKey,
      SUBMISSION_SYSTEM,
      buildSubmissionUserMessage(input),
    );
    const required = ["requirementsCoverage", "solutionClarity", "completeness"];
    for (const key of required) {
      if (typeof (llmRaw as any)[key]?.score !== "number") {
        throw new Error(`LLM submission response missing field: ${key}`);
      }
      (llmRaw as any)[key].score = clamp((llmRaw as any)[key].score);
    }

    const dims = {
      requirementsCoverage: { score: Math.round(llmRaw.requirementsCoverage.score), weight: 0.40, notes: llmRaw.requirementsCoverage.notes },
      solutionClarity:      { score: Math.round(llmRaw.solutionClarity.score),      weight: 0.30, notes: llmRaw.solutionClarity.notes },
      completeness:         heuristic.completeness, // always use heuristic (it checks artefacts)
    };
    const total = Math.round(clamp(
      dims.requirementsCoverage.score * dims.requirementsCoverage.weight +
      dims.solutionClarity.score      * dims.solutionClarity.weight +
      dims.completeness.score         * dims.completeness.weight
    ));
    return { ...dims, total, method: "llm+heuristic", summary: llmRaw.summary };
  } catch (err) {
    console.error("[evaluator] LLM submission eval failed, using heuristic:", (err as Error).message);
    return { ...heuristic, method: "heuristic" };
  }
}
