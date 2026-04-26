import { Router } from "express";
import { db } from "@bitcode/db";
import { z } from "zod";
import { CreateAttemptSchema, LogPromptEventSchema, SubmitAttemptSchema } from "@bitcode/shared";
import { scoreAttemptHeuristic } from "@bitcode/shared";

export const apiRouter = Router();

// Temporary auth for MVP scaffold: accept X-User-Id or create a demo user.
async function getUserId(req: any) {
  const hdr = String(req.header("x-user-id") || "").trim();
  if (hdr) return hdr;
  const demo = await db.user.upsert({
    where: { github: "demo" },
    update: {},
    create: { github: "demo", name: "Demo User" }
  });
  return demo.id;
}

apiRouter.get("/challenges", async (_req, res) => {
  const challenges = await db.challenge.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ ok: true, challenges });
});

apiRouter.post("/attempts", async (req, res) => {
  const parsed = CreateAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  const userId = await getUserId(req);
  const attempt = await db.attempt.create({
    data: {
      userId,
      challengeId: parsed.data.challengeId,
      status: "IN_PROGRESS"
    }
  });
  res.json({ ok: true, attempt });
});

apiRouter.post("/attempts/events", async (req, res) => {
  const parsed = LogPromptEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  const userId = await getUserId(req);

  const attempt = await db.attempt.findFirst({ where: { id: parsed.data.attemptId, userId } });
  if (!attempt) return res.status(404).json({ ok: false, error: "Attempt not found" });

  const ev = await db.promptEvent.create({
    data: {
      attemptId: parsed.data.attemptId,
      type: parsed.data.type,
      text: parsed.data.text,
      meta: parsed.data.meta ?? undefined
    }
  });
  res.json({ ok: true, event: ev });
});

// Submit attempt + trigger evaluation (heuristic for MVP).
apiRouter.post("/attempts/submit", async (req, res) => {
  const parsed = SubmitAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  const userId = await getUserId(req);

  const attempt = await db.attempt.findFirst({ where: { id: parsed.data.attemptId, userId } });
  if (!attempt) return res.status(404).json({ ok: false, error: "Attempt not found" });

  const updated = await db.attempt.update({
    where: { id: attempt.id },
    data: {
      status: "SUBMITTED",
      submissionUrl: parsed.data.submissionUrl,
      summary: parsed.data.summary ?? null,
      endedAt: new Date()
    }
  });

  res.json({ ok: true, attempt: updated });
});

// SSE: stream evaluation for an attempt.
apiRouter.get("/attempts/:attemptId/evaluate/stream", async (req, res) => {
  const attemptId = String(req.params.attemptId || "");
  const userId = await getUserId(req);

  const attempt = await db.attempt.findFirst({ where: { id: attemptId, userId }, include: { events: true } });
  if (!attempt) return res.status(404).json({ ok: false, error: "Attempt not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  function send(event: string, data: any) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  send("log", { message: "Starting evaluation…" });
  await new Promise((r) => setTimeout(r, 300));

  const startedAt = attempt.startedAt.getTime();
  const endedAt = (attempt.endedAt ?? new Date()).getTime();
  const breakdown = scoreAttemptHeuristic({
    startedAt,
    endedAt,
    events: attempt.events.map((e) => ({ type: e.type as any, text: e.text, createdAt: e.createdAt.getTime() })),
    hasSubmission: Boolean(attempt.submissionUrl)
  });

  send("log", { message: "Scoring complete" });
  send("score", breakdown);

  const saved = await db.attempt.update({
    where: { id: attempt.id },
    data: {
      status: "EVALUATED",
      scoreTotal: breakdown.total,
      score: breakdown as any
    }
  });

  send("done", { ok: true, attemptId: saved.id, total: saved.scoreTotal });
  res.end();
});

apiRouter.get("/leaderboard", async (_req, res) => {
  const top = await db.attempt.findMany({
    where: { status: "EVALUATED", scoreTotal: { not: null } },
    orderBy: { scoreTotal: "desc" },
    take: 50,
    include: { user: true, challenge: true }
  });
  res.json({ ok: true, top });
});

// Basic bounty endpoints (points-only MVP)
const CreateBountySchema = z.object({
  challengeId: z.string().min(6),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(8000),
  rewardPts: z.number().int().min(0).max(1_000_000).default(0)
});

apiRouter.post("/bounties", async (req, res) => {
  const parsed = CreateBountySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  const bounty = await db.bounty.create({ data: parsed.data as any });
  res.json({ ok: true, bounty });
});

apiRouter.get("/bounties", async (_req, res) => {
  const bounties = await db.bounty.findMany({ include: { challenge: true }, orderBy: { createdAt: "desc" } });
  res.json({ ok: true, bounties });
});

