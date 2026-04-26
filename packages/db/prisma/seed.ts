import { db } from "../src/index.js";

async function main() {
  // Seed 3 challenges.
  const challenges = [
    {
      slug: "debug-auth-callback",
      title: "Debug a broken OAuth callback",
      description: "Fix an OAuth callback that intermittently fails and add a regression test.",
      difficulty: 2,
      tags: ["debugging", "auth", "backend"],
      prompt:
        "You are given an Express OAuth callback handler that intermittently fails with 500s. Identify the root cause, propose fixes, and add a regression test. Submit a GitHub repo/PR link.",
      rubric: {
        correctness: "Callback works reliably; tests cover failure mode.",
        aiUsage: "Uses AI to hypothesize, verify with logs/tests, iterates intelligently."
      }
    },
    {
      slug: "build-sse-logs",
      title: "Build realtime SSE logs for a long-running job",
      description: "Implement SSE streaming for job logs and progress updates.",
      difficulty: 2,
      tags: ["backend", "sse", "realtime"],
      prompt:
        "Build an endpoint that starts a long-running job and streams logs via SSE. Include reconnect support and a minimal client.",
      rubric: {
        correctness: "SSE streams reliably; client can reconnect; no memory leak.",
        aiUsage: "Prompting shows decomposition + testing + iteration."
      }
    },
    {
      slug: "refactor-ai-generated-code",
      title: "Refactor AI-generated code safely",
      description: "Take messy AI-generated code and refactor with tests and clear commits.",
      difficulty: 3,
      tags: ["refactor", "testing", "quality"],
      prompt:
        "Refactor a provided module for readability + correctness. Add tests first, then refactor. Show your AI-assisted workflow.",
      rubric: {
        correctness: "Behavior preserved; tests added; refactor is clean.",
        aiUsage: "Uses AI for review and improvement, but validates with tests."
      }
    }
  ] as const;

  for (const c of challenges) {
    await db.challenge.upsert({
      where: { slug: c.slug },
      update: c,
      create: c
    });
  }

  // Seed a demo admin user and a demo bounty with an awarded payout
  const admin = await db.user.upsert({
    where: { github: "004mayank" },
    update: { name: "Mayank" },
    create: { github: "004mayank", name: "Mayank" }
  });
  const demoDev = await db.user.upsert({
    where: { github: "demo-dev" },
    update: { name: "Demo Dev" },
    create: { github: "demo-dev", name: "Demo Dev" }
  });

  const org = await db.organization.upsert({
    where: { slug: "bitcode" },
    update: { name: "BitCode" },
    create: { slug: "bitcode", name: "BitCode" }
  });

  await db.orgMember.upsert({
    where: { orgId_userId: { orgId: org.id, userId: admin.id } },
    update: { role: "OWNER" },
    create: { orgId: org.id, userId: admin.id, role: "OWNER" }
  });

  const challenge = await db.challenge.findFirst({ where: { slug: "build-sse-logs" } });
  if (challenge) {
    const bountyId = `seed-bounty-${org.id}`;
    const bounty = await db.bounty.upsert({
      where: { id: bountyId },
      update: {
        title: "[Seed] Realtime SSE logs bounty",
        description: "Seed bounty to populate Top Earners/Reputation leaderboards.",
        status: "AWARDED",
        visibility: "PUBLIC",
        rewardType: "POINTS",
        rewardPts: 500,
        rewardSplits: { winners: [{ github: "demo-dev", amountPts: 500 }] }
      },
      create: {
        id: bountyId,
        orgId: org.id,
        challengeId: challenge.id,
        title: "[Seed] Realtime SSE logs bounty",
        description: "Seed bounty to populate Top Earners/Reputation leaderboards.",
        status: "AWARDED",
        visibility: "PUBLIC",
        rewardType: "POINTS",
        rewardPts: 500,
        rewardSplits: { winners: [{ github: "demo-dev", amountPts: 500 }] }
      }
    });

    const submission = await db.submission.upsert({
      where: { id: `seed-sub-${bounty.id}` },
      update: {},
      create: {
        id: `seed-sub-${bounty.id}`,
        bountyId: bounty.id,
        userId: demoDev.id,
        status: "WINNER",
        repoUrl: "https://github.com/004mayank/BitCode",
        note: "Seed submission",
        finalScoreTotal: 92
      }
    });

    await db.payout.upsert({
      where: { id: `seed-payout-${submission.id}` },
      update: { status: "SENT", amountPts: 500 },
      create: {
        id: `seed-payout-${submission.id}`,
        bountyId: bounty.id,
        submissionId: submission.id,
        userId: demoDev.id,
        orgId: org.id,
        status: "SENT",
        provider: "NONE",
        amountPts: 500
      }
    });
  }

  console.log(`Seeded ${challenges.length} challenges`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
