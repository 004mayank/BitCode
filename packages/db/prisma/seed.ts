import { db } from "../src/index.js";

async function main() {
  // Seed a mixed set of real-world AI-native challenges.
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
    },

    {
      slug: "fix-n-plus-1-queries",
      title: "Fix N+1 queries in a feed endpoint",
      description: "Identify and remove an N+1 query pattern; add a regression perf test.",
      difficulty: 3,
      tags: ["backend", "database", "performance", "debugging"],
      prompt:
        "A /feed endpoint is slow in production due to N+1 queries. Use logs + query analysis to find the cause, fix it (e.g., joins/includes/batching), and add a regression test or measurement to prevent reintroduction.",
      rubric: {
        correctness: "Endpoint returns same results; query count reduced; test/measurement added.",
        aiUsage: "Uses AI to propose hypotheses, but validates with actual query plans/metrics."
      }
    },
    {
      slug: "design-rate-limiter",
      title: "Design and implement an API rate limiter",
      description: "Add per-user and per-IP rate limiting with clear headers and safe defaults.",
      difficulty: 2,
      tags: ["backend", "security", "api"],
      prompt:
        "Implement a rate limiter for an Express API: 60 rpm per user + 120 rpm per IP. Return standard rate limit headers, handle bursty traffic, and document tradeoffs. Provide tests.",
      rubric: {
        correctness: "Limits enforced; headers correct; tests cover edge cases.",
        aiUsage: "Prompts include constraints (headers, algorithm, storage), and iterates with tests."
      }
    },
    {
      slug: "nextjs-rsc-cache-bug",
      title: "Fix a Next.js caching bug with stale user data",
      description: "Diagnose stale data caused by caching and fix with correct cache settings.",
      difficulty: 3,
      tags: ["frontend", "nextjs", "debugging"],
      prompt:
        "A Next.js App Router page shows another user’s data intermittently due to caching/memoization. Identify root cause and fix using the right cache directives and fetch options. Add a regression test or reproduction doc.",
      rubric: {
        correctness: "No cross-user leakage; caching still works where safe.",
        aiUsage: "Uses AI to navigate Next.js caching rules; verifies with reproduction steps."
      }
    },
    {
      slug: "build-monaco-editor-submission",
      title: "Add an in-browser code editor with submission bundling",
      description: "Embed Monaco, persist files, and generate a submission bundle.",
      difficulty: 3,
      tags: ["frontend", "fullstack", "ux"],
      prompt:
        "Add a Monaco-based editor to a challenge page. Users can create/edit multiple files, and submission generates a tar/zip bundle or JSON artifact. Persist drafts locally and on server.",
      rubric: {
        correctness: "Editor works; multi-file; submission artifact reproducible.",
        aiUsage: "Prompts decompose UI state, persistence, and bundling; validates with manual QA."
      }
    },
    {
      slug: "ci-gate-for-submissions",
      title: "Add CI gating for submissions",
      description: "Introduce a standard CI workflow and block awarding if checks fail.",
      difficulty: 4,
      tags: ["devops", "ci", "quality"],
      prompt:
        "Design a CI standard for BitCode submissions (lint + test). Add logic that prevents awarding bounties if required checks failed or are missing. Provide a migration plan for old submissions.",
      rubric: {
        correctness: "Checks enforced; awarding rules documented; backwards compatibility handled.",
        aiUsage: "Uses AI to draft YAML + policy; confirms with real CI runs."
      }
    },
    {
      slug: "observability-sse-memory-leak",
      title: "Find and fix an SSE memory leak",
      description: "Debug an SSE endpoint that leaks listeners and memory over time.",
      difficulty: 4,
      tags: ["backend", "realtime", "observability", "debugging"],
      prompt:
        "An SSE endpoint slowly increases memory usage and CPU. Reproduce, identify leak source (listeners, buffers, closures), fix it, and add monitoring/metrics to prevent regressions.",
      rubric: {
        correctness: "Leak fixed; metrics show stability; fix covered by test or load script.",
        aiUsage: "Uses AI to suggest leak patterns; validates with heap snapshots or metrics."
      }
    },
    {
      slug: "secure-file-upload",
      title: "Secure file upload pipeline",
      description: "Implement file uploads with validation, scanning hooks, and signed URLs.",
      difficulty: 4,
      tags: ["security", "backend", "fullstack"],
      prompt:
        "Implement a secure file upload flow: signed upload URLs, MIME sniffing, size limits, and a stub for malware scanning. Store metadata in DB. Add tests and threat model notes.",
      rubric: {
        correctness: "Validation correct; no path traversal; signed URLs safe; tests cover bad inputs.",
        aiUsage: "Prompts include threat model + constraints; iterates after testing."
      }
    },
    {
      slug: "db-migration-with-zero-downtime",
      title: "Zero-downtime DB migration",
      description: "Perform a breaking schema change safely using expand/contract.",
      difficulty: 5,
      tags: ["database", "devops", "architecture"],
      prompt:
        "You need to rename a column used in production without downtime. Provide an expand/contract migration plan, code changes, and rollback strategy. Implement in a sample app.",
      rubric: {
        correctness: "No downtime; rollback possible; plan is complete.",
        aiUsage: "Uses AI for plan drafting, but validates with steps + safety checks."
      }
    },
    {
      slug: "build-eval-rubric-prompt",
      title: "Design a scoring rubric prompt for AI workflow",
      description: "Create an LLM rubric that evaluates workflow quality with calibration.",
      difficulty: 3,
      tags: ["ai", "product", "evaluation"],
      prompt:
        "Design a rubric prompt that scores prompt quality, iteration intelligence, and debugging method. Include calibration examples and explainability requirements. Provide a JSON output schema.",
      rubric: {
        correctness: "Rubric produces consistent structured output; easy to debug.",
        aiUsage: "Uses AI to iterate on rubric; tests against multiple sample transcripts."
      }
    },
    {
      slug: "frontend-perf-investigation",
      title: "Frontend performance investigation and fix",
      description: "Investigate slow interactions and fix re-renders with profiling.",
      difficulty: 3,
      tags: ["frontend", "performance", "debugging"],
      prompt:
        "A dashboard feels sluggish. Use React Profiler to identify excessive re-renders, fix with memoization or state restructuring, and verify improvements. Document findings.",
      rubric: {
        correctness: "Perf improved with evidence; no functional regressions.",
        aiUsage: "Uses AI to interpret profiler output; confirms with measurements."
      }
    },
    {
      slug: "implement-permissions-model",
      title: "Implement a permissions model for orgs",
      description: "Add role-based access control for org members and endpoints.",
      difficulty: 4,
      tags: ["backend", "security", "architecture"],
      prompt:
        "Implement RBAC for Organization members: OWNER/ADMIN/REVIEWER/MEMBER. Enforce permissions on bounty creation, review, and awarding. Add tests for permission matrix.",
      rubric: {
        correctness: "Matrix enforced; tests comprehensive; least privilege.",
        aiUsage: "Prompts include role matrix + edge cases; iterates with tests."
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

  // Seed a few OPEN bounties so the feed is alive.
  const openBountySpecs = [
    {
      slug: "fix-n-plus-1-queries",
      title: "Fix N+1 Queries (500 pts)",
      description: "Improve a slow feed endpoint by removing N+1 queries. Show your AI workflow and verification.",
      rewardPts: 500
    },
    {
      slug: "nextjs-rsc-cache-bug",
      title: "Next.js Cache Bug Hunt (600 pts)",
      description: "Fix cross-user stale data leakage caused by caching. Provide repro + fix + notes.",
      rewardPts: 600
    },
    {
      slug: "secure-file-upload",
      title: "Secure Upload Pipeline (900 pts)",
      description: "Implement a secure upload flow with validation and threat model notes.",
      rewardPts: 900
    },
    {
      slug: "observability-sse-memory-leak",
      title: "SSE Memory Leak (1000 pts)",
      description: "Reproduce and fix an SSE memory leak. Provide evidence/metrics.",
      rewardPts: 1000
    },
    {
      slug: "db-migration-with-zero-downtime",
      title: "Zero-downtime migration plan (1200 pts)",
      description: "Design and implement an expand/contract migration with rollback.",
      rewardPts: 1200
    }
  ] as const;

  for (const b of openBountySpecs) {
    const ch = await db.challenge.findFirst({ where: { slug: b.slug } });
    if (!ch) continue;
    await db.bounty.upsert({
      where: { id: `seed-open-${org.id}-${b.slug}` },
      update: {
        orgId: org.id,
        challengeId: ch.id,
        title: b.title,
        description: b.description,
        status: "OPEN",
        visibility: "PUBLIC",
        rewardType: "POINTS",
        rewardPts: b.rewardPts
      },
      create: {
        id: `seed-open-${org.id}-${b.slug}`,
        orgId: org.id,
        challengeId: ch.id,
        title: b.title,
        description: b.description,
        status: "OPEN",
        visibility: "PUBLIC",
        rewardType: "POINTS",
        rewardPts: b.rewardPts
      }
    });
  }

  // Keep one AWARDED bounty + winner payout for leaderboards.
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
