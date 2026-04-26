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

// --- Algora-style bounty system (scope B for now: single-admin, but full data model) ---

const CreateOrgSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(120),
  website: z.string().url().max(400).optional(),
  logoUrl: z.string().url().max(400).optional()
});

apiRouter.post("/orgs", async (req, res) => {
  const parsed = CreateOrgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  const org = await db.organization.create({ data: parsed.data });
  res.json({ ok: true, org });
});

apiRouter.get("/orgs", async (_req, res) => {
  const orgs = await db.organization.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ ok: true, orgs });
});

const CreateBountySchema = z.object({
  orgId: z.string().min(6).optional(),
  challengeId: z.string().min(6),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(8000),
  status: z.enum(["DRAFT", "OPEN"]).default("OPEN"),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).default("PUBLIC"),
  rewardType: z.enum(["POINTS", "USD"]).default("POINTS"),
  rewardPts: z.number().int().min(0).max(1_000_000).default(0),
  deadline: z.string().datetime().optional(),
  requirements: z.record(z.any()).optional()
});

apiRouter.post("/bounties", async (req, res) => {
  const parsed = CreateBountySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const bounty = await db.bounty.create({
    data: {
      orgId: parsed.data.orgId ?? null,
      challengeId: parsed.data.challengeId,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status as any,
      visibility: parsed.data.visibility as any,
      rewardType: parsed.data.rewardType as any,
      rewardPts: parsed.data.rewardPts,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      requirements: parsed.data.requirements ?? undefined
    }
  });
  res.json({ ok: true, bounty });
});

apiRouter.get("/bounties", async (req, res) => {
  const status = String(req.query.status || "");
  const where: any = {};
  if (status) where.status = status;
  const bounties = await db.bounty.findMany({
    where,
    include: { challenge: true, org: true },
    orderBy: { createdAt: "desc" }
  });
  res.json({ ok: true, bounties });
});

apiRouter.get("/bounties/:bountyId", async (req, res) => {
  const bountyId = String(req.params.bountyId || "");
  const bounty = await db.bounty.findFirst({
    where: { id: bountyId },
    include: { challenge: true, org: true, submissions: { include: { user: true }, orderBy: { createdAt: "desc" } } }
  });
  if (!bounty) return res.status(404).json({ ok: false, error: "Bounty not found" });
  res.json({ ok: true, bounty });
});

const CreateSubmissionSchema = z.object({
  bountyId: z.string().min(6),
  repoUrl: z.string().url().max(1000),
  prUrl: z.string().url().max(1000).optional(),
  commitSha: z.string().min(7).max(64).optional(),
  note: z.string().max(4000).optional()
});

apiRouter.post("/bounties/:bountyId/submissions", async (req, res) => {
  const bountyId = String(req.params.bountyId || "");
  const parsed = CreateSubmissionSchema.safeParse({ ...req.body, bountyId });
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const userId = await getUserId(req);
  const bounty = await db.bounty.findFirst({ where: { id: bountyId } });
  if (!bounty) return res.status(404).json({ ok: false, error: "Bounty not found" });
  if (bounty.status !== "OPEN") return res.status(409).json({ ok: false, error: `Bounty not open (status=${bounty.status})` });

  const sub = await db.submission.create({
    data: {
      bountyId,
      userId,
      repoUrl: parsed.data.repoUrl,
      prUrl: parsed.data.prUrl ?? null,
      commitSha: parsed.data.commitSha ?? null,
      note: parsed.data.note ?? null,
      status: "SUBMITTED"
    }
  });
  res.json({ ok: true, submission: sub });
});

// Manual review (admin-only in scope B)
const ReviewSchema = z.object({
  comment: z.string().min(1).max(8000),
  scoreTotal: z.number().int().min(0).max(100).optional(),
  rubric: z.record(z.any()).optional(),
  isPublic: z.boolean().default(false)
});

apiRouter.post("/submissions/:submissionId/reviews", async (req, res) => {
  const submissionId = String(req.params.submissionId || "");
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const reviewerId = await getUserId(req);
  const submission = await db.submission.findFirst({ where: { id: submissionId }, include: { bounty: true } });
  if (!submission) return res.status(404).json({ ok: false, error: "Submission not found" });

  const review = await db.submissionReview.create({
    data: {
      submissionId,
      reviewerId,
      orgId: submission.bounty.orgId ?? null,
      comment: parsed.data.comment,
      scoreTotal: parsed.data.scoreTotal ?? null,
      rubric: parsed.data.rubric ?? undefined,
      isPublic: parsed.data.isPublic
    }
  });
  res.json({ ok: true, review });
});

// Award: pick winners + create payout intents (points only for now)
const AwardSchema = z.object({
  winners: z
    .array(
      z.object({
        submissionId: z.string().min(6),
        amountPts: z.number().int().min(0).max(1_000_000)
      })
    )
    .min(1)
});

apiRouter.post("/bounties/:bountyId/award", async (req, res) => {
  const bountyId = String(req.params.bountyId || "");
  const parsed = AwardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const bounty = await db.bounty.findFirst({ where: { id: bountyId }, include: { submissions: true } });
  if (!bounty) return res.status(404).json({ ok: false, error: "Bounty not found" });

  const submissionIds = new Set(bounty.submissions.map((s) => s.id));
  for (const w of parsed.data.winners) {
    if (!submissionIds.has(w.submissionId)) return res.status(400).json({ ok: false, error: "Winner submission not in this bounty" });
  }

  // Mark bounty + submissions
  await db.bounty.update({ where: { id: bountyId }, data: { status: "AWARDED", rewardSplits: parsed.data as any } });

  for (const w of parsed.data.winners) {
    await db.submission.update({ where: { id: w.submissionId }, data: { status: "WINNER", finalScoreTotal: null } });
    const sub = await db.submission.findFirst({ where: { id: w.submissionId } });
    if (sub) {
      await db.payout.create({
        data: {
          bountyId,
          submissionId: sub.id,
          userId: sub.userId,
          orgId: bounty.orgId ?? null,
          status: "PENDING",
          provider: "NONE",
          amountPts: w.amountPts
        }
      });
    }
  }

  res.json({ ok: true });
});
