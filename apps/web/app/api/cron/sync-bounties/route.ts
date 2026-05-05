import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { ExternalBountySource, ExternalBountyType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BountyRecord {
  source: ExternalBountySource;
  externalId: string;
  title: string;
  description: string;
  url: string;
  company: string;
  logoUrl?: string;
  type: ExternalBountyType;
  tags: string[];
  isOpen: boolean;
  rewardMin?: number;  // USD cents
  rewardMax?: number;  // USD cents
  rewardLabel?: string;
  currency: string;
  deadline?: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

async function safeFetch(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      "User-Agent": "Mozilla/5.0 BitCode/1.0 bounty-aggregator",
      "Accept": "application/json",
    },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

// ─── Algora — OSS bounties via tRPC ──────────────────────────────────────────
// Public endpoint, no auth required. Returns cursor-paginated items.

async function fetchAlgora(): Promise<BountyRecord[]> {
  const results: BountyRecord[] = [];
  let cursor: string | null = null;
  let page = 0;
  const MAX_PAGES = 5;

  while (page < MAX_PAGES) {
    const input = JSON.stringify({
      "0": { json: { status: "open", limit: 100, ...(cursor ? { cursor } : {}) } },
    });
    const url = `https://console.algora.io/api/trpc/bounty.list?batch=1&input=${encodeURIComponent(input)}`;
    let data: any;
    try {
      data = await safeFetch(url);
    } catch (e) {
      console.warn("[algora] fetch failed:", (e as Error).message);
      break;
    }

    const json = data?.[0]?.result?.data?.json;
    const items: any[] = json?.items ?? [];
    cursor = json?.next_cursor ?? null;

    for (const item of items) {
      const task = item.task ?? {};
      const org  = item.org  ?? {};
      // reward.amount is in USD cents (e.g. 10000 = $100)
      const rewardCents: number = item.reward?.amount ?? 0;
      const rewardFormatted: string | undefined = item.reward_formatted ?? undefined;

      results.push({
        source: "ALGORA",
        externalId: String(item.id),
        title: task.title ?? "Untitled",
        description: (task.body ?? "").slice(0, 500),
        url: task.url ?? `https://console.algora.io/bounties`,
        company: org.display_name ?? org.name ?? org.handle ?? "Open Source",
        logoUrl: org.avatar_url ?? undefined,
        type: "OSS",
        tags: [...(item.tech ?? []), ...(task.tech ?? [])].filter(Boolean),
        isOpen: item.status === "open",
        rewardMin: rewardCents > 0 ? rewardCents : undefined,
        rewardMax: rewardCents > 0 ? rewardCents : undefined,
        rewardLabel: rewardFormatted ?? (rewardCents > 0 ? `$${(rewardCents / 100).toLocaleString()}` : undefined),
        currency: item.reward?.currency ?? "USD",
      });
    }

    page++;
    if (!cursor || items.length === 0) break;
  }

  return results;
}

// ─── HackerOne — public bug bounty programs ───────────────────────────────────
// Uses the public program search endpoint — no API key needed.

async function fetchHackerOne(): Promise<BountyRecord[]> {
  const results: BountyRecord[] = [];

  for (let page = 1; page <= 5; page++) {
    const url = `https://hackerone.com/programs/search.json?query=type%3Ahackerone+bounty%3Atrue&sort=started_accepting_at%3Adescending&page=${page}`;
    let data: any;
    try {
      data = await safeFetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 BitCode/1.0 bounty-aggregator",
          "Accept": "application/json",
          "Referer": "https://hackerone.com/directory/programs",
        },
      });
    } catch (e) {
      console.warn(`[hackerone] page ${page} failed:`, (e as Error).message);
      break;
    }

    const programs: any[] = data?.results ?? [];
    if (programs.length === 0) break;

    for (const p of programs) {
      const meta = p.meta ?? {};
      // Only include programs that explicitly offer bounties
      if (!meta.offers_bounties) continue;

      const minBounty: number | undefined = meta.minimum_bounty ?? undefined;
      results.push({
        source: "HACKERONE",
        externalId: String(p.id),
        title: `${p.name} Bug Bounty`,
        description: (p.about ?? "").slice(0, 500),
        url: `https://hackerone.com/${p.handle}`,
        company: p.name,
        logoUrl: p.profile_picture ?? undefined,
        type: "BUG_BOUNTY",
        tags: ["security", "bug-bounty"],
        isOpen: meta.submission_state === "open",
        rewardMin: minBounty ? usdToCents(minBounty) : undefined,
        rewardMax: undefined, // not in public search response
        rewardLabel: minBounty ? `From $${minBounty.toLocaleString()}` : undefined,
        currency: meta.default_currency?.toUpperCase() ?? "USD",
      });
    }

    // Stop early if we already have plenty
    if (results.length >= 300) break;
  }

  return results;
}

// ─── Batch upsert ─────────────────────────────────────────────────────────────

async function upsertBatch(records: BountyRecord[]): Promise<number> {
  let count = 0;
  // Process in batches of 50 to avoid overwhelming the DB
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50);
    await Promise.all(
      batch.map(async (r) => {
        try {
          await prisma.externalBounty.upsert({
            where: { source_externalId: { source: r.source, externalId: r.externalId } },
            create: {
              source: r.source,
              externalId: r.externalId,
              title: r.title,
              description: r.description,
              url: r.url,
              company: r.company,
              logoUrl: r.logoUrl,
              type: r.type,
              tags: r.tags,
              isOpen: r.isOpen,
              rewardMin: r.rewardMin,
              rewardMax: r.rewardMax,
              rewardLabel: r.rewardLabel,
              currency: r.currency,
              deadline: r.deadline,
              fetchedAt: new Date(),
            },
            update: {
              title: r.title,
              description: r.description,
              url: r.url,
              company: r.company,
              logoUrl: r.logoUrl,
              type: r.type,
              tags: r.tags,
              isOpen: r.isOpen,
              rewardMin: r.rewardMin,
              rewardMax: r.rewardMax,
              rewardLabel: r.rewardLabel,
              currency: r.currency,
              deadline: r.deadline,
              fetchedAt: new Date(),
            },
          });
          count++;
        } catch (e) {
          console.error(`[upsert] ${r.source}/${r.externalId}:`, (e as Error).message);
        }
      })
    );
  }
  return count;
}

// ─── Cron handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (skip check locally if not set)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const results: Record<string, { fetched: number; upserted: number; error?: string }> = {};

  // Fetch from all sources in parallel
  const [algoraResult, h1Result] = await Promise.allSettled([
    fetchAlgora(),
    fetchHackerOne(),
  ]);

  const fetchers = [
    { name: "algora",    result: algoraResult },
    { name: "hackerone", result: h1Result },
  ];

  let totalUpserted = 0;

  for (const { name, result } of fetchers) {
    if (result.status === "fulfilled") {
      const records = result.value;
      const upserted = await upsertBatch(records);
      results[name] = { fetched: records.length, upserted };
      totalUpserted += upserted;
      console.log(`[sync-bounties] ${name}: ${records.length} fetched, ${upserted} upserted`);
    } else {
      const error = (result.reason as Error)?.message ?? "unknown";
      results[name] = { fetched: 0, upserted: 0, error };
      console.error(`[sync-bounties] ${name} failed:`, error);
    }
  }

  const elapsed = Date.now() - startedAt;
  console.log(`[sync-bounties] done in ${elapsed}ms — ${totalUpserted} total upserted`);

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    elapsedMs: elapsed,
    totalUpserted,
    results,
  });
}
