import { Router } from "express";
import { db } from "@bitcode/db/src/index.js";
import { z } from "zod";
import { CreateAttemptSchema, LogPromptEventSchema, SubmitAttemptSchema } from "@bitcode/shared";
import { scoreAttemptHeuristic } from "@bitcode/shared";
import { requireAdmin, requireUser, getUser } from "./auth.js";
import { RunStore } from "./runStore.js";
import { nanoid } from "nanoid";
import { spawn } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";

export const apiRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/** Compute daily activity counts for a user over the last N days from existing tables. */
async function getUserActivity(userId: string, days = 365): Promise<Record<string, number>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [attempts, events, submissions] = await Promise.all([
    db.attempt.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } }),
    db.promptEvent.findMany({
      where: { attempt: { userId }, createdAt: { gte: since } },
      select: { createdAt: true }
    }),
    db.submission.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } })
  ]);

  const map: Record<string, number> = {};
  const add = (d: Date) => { const k = toDateStr(d); map[k] = (map[k] ?? 0) + 1; };
  attempts.forEach(a => add(a.createdAt));
  events.forEach(e => add(e.createdAt));
  submissions.forEach(s => add(s.createdAt));
  return map;
}

/** Given a date→count map, compute current streak, longest streak, and total active days. */
function computeStreaks(activity: Record<string, number>): {
  currentStreak: number; longestStreak: number; totalActiveDays: number; lastActiveDate: string | null;
} {
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));

  const activeDays = Object.keys(activity).filter(d => activity[d] > 0).sort();
  const totalActiveDays = activeDays.length;
  if (totalActiveDays === 0) return { currentStreak: 0, longestStreak: 0, totalActiveDays: 0, lastActiveDate: null };

  const lastActiveDate = activeDays[activeDays.length - 1];

  // Current streak: count back from today (or yesterday if not active today)
  let currentStreak = 0;
  if (lastActiveDate === today || lastActiveDate === yesterday) {
    let cursor = new Date(lastActiveDate + "T00:00:00Z");
    while (true) {
      const key = toDateStr(cursor);
      if (!activity[key]) break;
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // Longest streak
  let longestStreak = 0, run = 0;
  let prev: Date | null = null;
  for (const day of activeDays) {
    const cur = new Date(day + "T00:00:00Z");
    if (prev) {
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    longestStreak = Math.max(longestStreak, run);
    prev = cur;
  }

  return { currentStreak, longestStreak, totalActiveDays, lastActiveDate };
}

async function recomputeUserStats(userId: string) {
  const [subsAgg, winsAgg, attemptsAgg] = await Promise.all([
    db.submission.aggregate({
      where: { userId },
      _count: { _all: true },
      _avg: { finalScoreTotal: true, autoScoreTotal: true, manualScoreTotal: true }
    }),
    db.submission.aggregate({
      where: { userId, status: "WINNER" },
      _count: { _all: true }
    }),
    db.attempt.aggregate({
      where: { userId, status: "EVALUATED", scoreTotal: { not: null } },
      _avg: { scoreTotal: true }
    })
  ]);

  const payouts = await db.payout.findMany({ where: { userId, status: { in: ["PENDING", "APPROVED", "SENT"] } } });
  const bountyEarnedPts = payouts.reduce((s, p) => s + (p.amountPts || 0), 0);
  const bountiesWon = winsAgg._count._all;
  const submissionsCount = subsAgg._count._all;

  const avgAttemptScore = Math.round(Number(attemptsAgg._avg.scoreTotal || 0));
  const reputationPts = Math.max(0, Math.round(bountyEarnedPts + avgAttemptScore * 2 + bountiesWon * 100));
  const avgSubmissionScore = Math.round(
    Number(subsAgg._avg.finalScoreTotal ?? subsAgg._avg.manualScoreTotal ?? subsAgg._avg.autoScoreTotal ?? 0)
  );

  // Compute streaks from activity
  const activity = await getUserActivity(userId, 365);
  const { currentStreak, longestStreak, totalActiveDays, lastActiveDate } = computeStreaks(activity);

  await db.userStats.upsert({
    where: { userId },
    update: { reputationPts, bountyEarnedPts, bountiesWon, submissionsCount, avgSubmissionScore, currentStreak, longestStreak, totalActiveDays, lastActiveDate },
    create: { userId, reputationPts, bountyEarnedPts, bountiesWon, submissionsCount, avgSubmissionScore, currentStreak, longestStreak, totalActiveDays, lastActiveDate }
  });
}

// Auth: require Bearer token (NextAuth JWT) for write endpoints.

apiRouter.get("/challenges", async (_req, res) => {
  const challenges = await db.challenge.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ ok: true, challenges });
});

apiRouter.get("/me", async (req, res) => {
  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  const stats = await db.userStats.findFirst({ where: { userId: (user as any).id } });
  res.json({ ok: true, user, stats });
});

/** Returns daily activity counts for the last 365 days: { "2026-04-27": 5, ... } */
apiRouter.get("/me/activity", async (req, res) => {
  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  const activity = await getUserActivity((user as any).id, 365);
  res.json({ ok: true, activity });
});

/** Public activity for any user by id (for viewing others' profiles) */
apiRouter.get("/users/:userId/activity", async (req, res) => {
  const { userId } = req.params;
  const activity = await getUserActivity(userId, 365);
  res.json({ ok: true, activity });
});

apiRouter.post("/attempts", async (req, res) => {
  const parsed = CreateAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  const user = await getUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  const attempt = await db.attempt.create({
    data: {
      userId: (user as any).id,
      challengeId: parsed.data.challengeId,
      status: "IN_PROGRESS"
    }
  });
  // Update streak immediately when user starts working
  recomputeUserStats((user as any).id).catch(() => {});
  res.json({ ok: true, attempt });
});

apiRouter.post("/attempts/events", async (req, res) => {
  const parsed = LogPromptEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  const user = await getUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });

  const attempt = await db.attempt.findFirst({ where: { id: parsed.data.attemptId, userId: (user as any).id } });
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
  const user = await getUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });

  const attempt = await db.attempt.findFirst({ where: { id: parsed.data.attemptId, userId: (user as any).id } });
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

  await recomputeUserStats((user as any).id);
  res.json({ ok: true, attempt: updated });
});

// SSE: stream evaluation for an attempt.
apiRouter.get("/attempts/:attemptId/evaluate/stream", async (req, res) => {
  const attemptId = String(req.params.attemptId || "");
  const user = await getUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });

  const attempt = await db.attempt.findFirst({ where: { id: attemptId, userId: (user as any).id }, include: { events: true } });
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

  await recomputeUserStats((user as any).id);

  send("done", { ok: true, attemptId: saved.id, total: saved.scoreTotal });
  res.end();
});

// ── AI Chat ──────────────────────────────────────────────────────────────────

const ChatSchema = z.object({
  attemptId: z.string().min(6).optional(),
  message: z.string().min(1).max(8000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })).max(40).default([]),
  challengeContext: z.string().max(4000).optional()
});

async function callAnthropic(apiKey: string, systemPrompt: string, messages: Anthropic.MessageParam[]): Promise<string> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages
  });
  return response.content.filter((b) => b.type === "text").map((b) => (b as any).text).join("");
}

async function callOpenAI(apiKey: string, systemPrompt: string, messages: Anthropic.MessageParam[]): Promise<string> {
  const body = {
    model: "gpt-4o",
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ]
  };
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `OpenAI error ${resp.status}`);
  }
  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content ?? "";
}

apiRouter.post("/chat", async (req, res) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  // Key comes from the client header — never stored on our side
  const userKey      = String(req.headers["x-ai-key"]      || "").trim();
  const userProvider = String(req.headers["x-ai-provider"] || "anthropic").toLowerCase();

  if (!userKey) {
    return res.status(401).json({ ok: false, error: "No API key provided. Add your Anthropic or OpenAI key in Settings." });
  }

  const user = await getUser(req).catch(() => null);
  const { attemptId, message, history, challengeContext } = parsed.data;

  const systemPrompt = [
    "You are a helpful coding assistant inside BitCode, an AI-native developer challenge platform.",
    "Help the user understand and solve the coding challenge they are working on.",
    "Be concise and practical. Prefer code examples when helpful.",
    challengeContext ? `\nChallenge context:\n${challengeContext}` : ""
  ].filter(Boolean).join("\n");

  const messages: Anthropic.MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content } as Anthropic.MessageParam)),
    { role: "user", content: message }
  ];

  try {
    let reply: string;
    if (userProvider === "openai") {
      reply = await callOpenAI(userKey, systemPrompt, messages);
    } else {
      reply = await callAnthropic(userKey, systemPrompt, messages);
    }

    // Auto-log the user message as a prompt event — key is never included in the log
    if (attemptId && user) {
      const attempt = await db.attempt.findFirst({ where: { id: attemptId, userId: (user as any).id } });
      if (attempt) {
        await db.promptEvent.create({
          data: { attemptId, type: "prompt", text: message, meta: { source: "chat", provider: userProvider } as any }
        }).catch(() => {});
      }
    }

    res.json({ ok: true, reply });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const status = msg.includes("401") || msg.includes("invalid") || msg.includes("Incorrect API key") ? 401 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
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

apiRouter.get("/leaderboard/reputation", async (_req, res) => {
  const top = await db.userStats.findMany({
    orderBy: { reputationPts: "desc" },
    take: 50,
    include: { user: true }
  });
  res.json({ ok: true, top });
});

apiRouter.get("/leaderboard/earnings", async (_req, res) => {
  const top = await db.userStats.findMany({
    orderBy: { bountyEarnedPts: "desc" },
    take: 50,
    include: { user: true }
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
  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  try {
    requireAdmin(user as any);
  } catch (e: any) {
    return res.status(403).json({ ok: false, error: String(e?.message || e) });
  }
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

  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  try {
    requireAdmin(user as any);
  } catch (e: any) {
    return res.status(403).json({ ok: false, error: String(e?.message || e) });
  }

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

// --- Docker execution (Python v1) ---
const RunSchema = z.object({
  language: z.enum(["python"]).default("python"),
  entry: z.string().default("main.py"),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(200),
        content: z.string().max(200000)
      })
    )
    .min(1)
});

apiRouter.post("/run", async (req, res) => {
  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });

  const parsed = RunSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const runId = nanoid(10);
  RunStore.create(runId);

  // Ensure image exists; build is handled out-of-band in dev.
  const image = "bitcode-runner-python:local";
  const dockerArgs = [
    "run",
    "--rm",
    "-i",
    "--network",
    "none",
    "--cpus",
    "1",
    "--memory",
    "512m",
    "--pids-limit",
    "128",
    image
  ];

  const child = spawn("docker", dockerArgs, { stdio: ["pipe", "pipe", "pipe"] });
  const payload = { ...parsed.data };
  child.stdin.write(JSON.stringify(payload));
  child.stdin.end();

  let tail = "";
  function onData(buf: Buffer, stream: "stdout" | "stderr") {
    const s = buf.toString("utf8");
    for (const line of s.split(/\r?\n/)) {
      if (!line) continue;
      RunStore.appendLog(runId, `${stream}: ${line}`);
      if (line.startsWith("[result] ")) {
        try {
          const j = JSON.parse(line.slice(9));
          RunStore.setResult(runId, j);
        } catch (e: any) {
          RunStore.setError(runId, `bad result json: ${String(e?.message || e)}`);
        }
      }
      tail = (tail + "\n" + line).slice(-20000);
    }
  }
  child.stdout.on("data", (b) => onData(b as Buffer, "stdout"));
  child.stderr.on("data", (b) => onData(b as Buffer, "stderr"));
  child.on("exit", (code) => {
    const r = RunStore.get(runId);
    if (!r) return;
    if (r.status === "running") {
      RunStore.setError(runId, `docker exited code=${code}`);
    }
  });

  res.json({ ok: true, runId });
});

apiRouter.get("/run/:runId/result", async (req, res) => {
  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  const runId = String(req.params.runId || "");
  const r = RunStore.get(runId);
  if (!r) return res.status(404).json({ ok: false, error: "run not found" });
  res.json({ ok: true, run: r });
});

apiRouter.get("/run/:runId/stream", async (req, res) => {
  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  const runId = String(req.params.runId || "");
  const r = RunStore.get(runId);
  if (!r) return res.status(404).json({ ok: false, error: "run not found" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const startIndex = Number(req.query.from || 0);
  let idx = isFinite(startIndex) ? startIndex : 0;

  function send(event: string, data: any) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  const timer = setInterval(() => {
    const cur = RunStore.get(runId);
    if (!cur) {
      clearInterval(timer);
      res.end();
      return;
    }
    while (idx < cur.logs.length) {
      send("log", { line: cur.logs[idx], index: idx });
      idx++;
    }
    if (cur.status !== "running") {
      send("done", { status: cur.status, result: cur.result, error: cur.error });
      clearInterval(timer);
      res.end();
    }
  }, 250);

  req.on("close", () => clearInterval(timer));
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

  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  const bounty = await db.bounty.findFirst({ where: { id: bountyId } });
  if (!bounty) return res.status(404).json({ ok: false, error: "Bounty not found" });
  if (bounty.status !== "OPEN") return res.status(409).json({ ok: false, error: `Bounty not open (status=${bounty.status})` });

  const sub = await db.submission.create({
    data: {
      bountyId,
      userId: (user as any).id,
      repoUrl: parsed.data.repoUrl,
      prUrl: parsed.data.prUrl ?? null,
      commitSha: parsed.data.commitSha ?? null,
      note: parsed.data.note ?? null,
      status: "SUBMITTED"
    }
  });

  await recomputeUserStats((user as any).id);
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

  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  try {
    requireAdmin(user as any);
  } catch (e: any) {
    return res.status(403).json({ ok: false, error: String(e?.message || e) });
  }
  const submission = await db.submission.findFirst({ where: { id: submissionId }, include: { bounty: true } });
  if (!submission) return res.status(404).json({ ok: false, error: "Submission not found" });

  const review = await db.submissionReview.create({
    data: {
      submissionId,
      reviewerId: (user as any).id,
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

  const user = await requireUser(req).catch((e) => ({ error: String(e?.message || e) } as any));
  if ((user as any).error) return res.status(401).json({ ok: false, error: (user as any).error });
  try {
    requireAdmin(user as any);
  } catch (e: any) {
    return res.status(403).json({ ok: false, error: String(e?.message || e) });
  }

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

      await recomputeUserStats(sub.userId);
    }
  }

  res.json({ ok: true });
});
