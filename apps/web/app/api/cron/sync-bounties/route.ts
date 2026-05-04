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

function parseDollar(str?: string | null): number | undefined {
  if (!str) return undefined;
  const n = parseFloat(str.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : usdToCents(n);
}

async function safeFetch(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { "User-Agent": "BitCode/1.0 bounty-aggregator", "Accept": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// ─── Platform fetchers ────────────────────────────────────────────────────────

/** Algora — OSS bounties on GitHub issues */
async function fetchAlgora(): Promise<BountyRecord[]> {
  const url = "https://api.algora.io/v1/bounties?status=open&limit=100";
  let data: any;
  try {
    data = await safeFetch(url);
  } catch (e) {
    console.warn("[algora] fetch failed:", (e as Error).message);
    return [];
  }
  const items: any[] = Array.isArray(data) ? data : (data?.bounties ?? data?.data ?? []);
  return items.map((b: any) => {
    const rewardUsd = b.reward_usd ?? b.reward ?? 0;
    return {
      source: "ALGORA" as ExternalBountySource,
      externalId: String(b.id ?? b.issue_id ?? b.url),
      title: b.title ?? b.issue?.title ?? "Untitled",
      description: b.description ?? b.issue?.body?.slice(0, 500) ?? "",
      url: b.url ?? b.issue_url ?? b.html_url ?? "",
      company: b.org ?? b.organization?.name ?? b.repo?.owner ?? "Open Source",
      logoUrl: b.org_avatar ?? b.organization?.avatar_url ?? undefined,
      type: "OSS" as ExternalBountyType,
      tags: b.labels ?? b.tags ?? [],
      isOpen: true,
      rewardMin: rewardUsd > 0 ? usdToCents(rewardUsd) : undefined,
      rewardMax: rewardUsd > 0 ? usdToCents(rewardUsd) : undefined,
      rewardLabel: rewardUsd > 0 ? `$${rewardUsd.toLocaleString()}` : undefined,
      currency: "USD",
    };
  });
}

/** IssueHunt — OSS bounties */
async function fetchIssueHunt(): Promise<BountyRecord[]> {
  const url = "https://issuehunt.io/api/v1/issues?status=open&limit=100";
  let data: any;
  try {
    data = await safeFetch(url);
  } catch (e) {
    console.warn("[issuehunt] fetch failed:", (e as Error).message);
    return [];
  }
  const items: any[] = Array.isArray(data) ? data : (data?.issues ?? data?.data ?? []);
  return items.map((b: any) => {
    const reward = b.funded_by_sum ?? b.reward ?? 0;
    return {
      source: "ISSUEHUNT" as ExternalBountySource,
      externalId: String(b.id ?? b.uid ?? b.html_url),
      title: b.title ?? "Untitled",
      description: (b.body ?? "").slice(0, 500),
      url: b.html_url ?? b.url ?? "",
      company: b.repo?.owner?.login ?? b.owner ?? "Open Source",
      logoUrl: b.repo?.owner?.avatar_url ?? undefined,
      type: "OSS" as ExternalBountyType,
      tags: (b.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name)),
      isOpen: true,
      rewardMin: reward > 0 ? usdToCents(reward) : undefined,
      rewardMax: reward > 0 ? usdToCents(reward) : undefined,
      rewardLabel: reward > 0 ? `$${reward.toLocaleString()}` : undefined,
      currency: "USD",
    };
  });
}

/** HackerOne — public bug bounty programs */
async function fetchHackerOne(): Promise<BountyRecord[]> {
  const url =
    "https://api.hackerone.com/v1/hackers/programs?page[size]=100&filter[submission_state]=open&filter[offers_bounties]=true&sort=started_accepting_at:desc";
  let data: any;
  try {
    data = await safeFetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "BitCode/1.0 bounty-aggregator",
      },
    });
  } catch (e) {
    console.warn("[hackerone] fetch failed:", (e as Error).message);
    return [];
  }
  const items: any[] = data?.data ?? [];
  return items.slice(0, 80).map((p: any) => {
    const attr = p.attributes ?? {};
    const handle = attr.handle ?? p.id;
    const minBounty = attr.minimum_bounty_table_value;
    const maxBounty = attr.maximum_bounty_table_value;
    return {
      source: "HACKERONE" as ExternalBountySource,
      externalId: String(p.id ?? handle),
      title: `${attr.name ?? handle} Bug Bounty`,
      description: (attr.profile_picture_urls?.medium
        ? ""
        : attr.description_html ?? attr.description ?? "").slice(0, 500),
      url: `https://hackerone.com/${handle}`,
      company: attr.name ?? handle,
      logoUrl: attr.profile_picture_urls?.medium ?? undefined,
      type: "BUG_BOUNTY" as ExternalBountyType,
      tags: ["security", "bug-bounty"],
      isOpen: attr.submission_state === "open",
      rewardMin: parseDollar(minBounty),
      rewardMax: parseDollar(maxBounty),
      rewardLabel:
        maxBounty
          ? `Up to $${parseFloat(String(maxBounty)).toLocaleString()}`
          : minBounty
          ? `From $${parseFloat(String(minBounty)).toLocaleString()}`
          : undefined,
      currency: "USD",
    };
  });
}

/** Intigriti — public bug bounty programs */
async function fetchIntigriti(): Promise<BountyRecord[]> {
  const url = "https://api.intigriti.com/core/researcher/programs?limit=100&status=3"; // status=3 = live
  let data: any;
  try {
    data = await safeFetch(url);
  } catch (e) {
    console.warn("[intigriti] fetch failed:", (e as Error).message);
    return [];
  }
  const items: any[] = Array.isArray(data) ? data : (data?.records ?? data?.data ?? []);
  return items.map((p: any) => {
    const maxBounty = p.maxBounty ?? p.maxBountyValue ?? p.maxReward;
    const minBounty = p.minBounty ?? p.minBountyValue;
    return {
      source: "INTIGRITI" as ExternalBountySource,
      externalId: String(p.id ?? p.programId ?? p.handle),
      title: `${p.name ?? p.programName ?? "Program"} Bug Bounty`,
      description: (p.description ?? "").slice(0, 500),
      url: p.url ?? `https://app.intigriti.com/programs/${p.handle ?? p.id}`,
      company: p.name ?? p.companyName ?? "Unknown",
      logoUrl: p.logoUrl ?? p.logo ?? undefined,
      type: "BUG_BOUNTY" as ExternalBountyType,
      tags: ["security", "bug-bounty"],
      isOpen: true,
      rewardMin: maxBounty ? usdToCents(minBounty ?? 0) : undefined,
      rewardMax: maxBounty ? usdToCents(maxBounty) : undefined,
      rewardLabel: maxBounty ? `Up to €${maxBounty.toLocaleString()}` : undefined,
      currency: "EUR",
    };
  });
}

/** Immunefi — DeFi / Web3 bug bounty programs */
async function fetchImmunefi(): Promise<BountyRecord[]> {
  const url = "https://immunefi.com/explore.json";
  let data: any;
  try {
    data = await safeFetch(url);
  } catch (e) {
    console.warn("[immunefi] fetch failed:", (e as Error).message);
    return [];
  }
  const items: any[] = Array.isArray(data) ? data : (data?.projects ?? data?.bounties ?? []);
  return items.slice(0, 80).map((p: any) => {
    const maxPayout = p.maxBounty ?? p.max_bounty ?? p.totalMaxBounty;
    return {
      source: "IMMUNEFI" as ExternalBountySource,
      externalId: String(p.id ?? p.slug ?? p.project),
      title: `${p.project ?? p.name ?? "Protocol"} Bug Bounty`,
      description: (p.description ?? "Security bug bounty program on Immunefi.").slice(0, 500),
      url: p.url ?? `https://immunefi.com/bug-bounty/${p.slug ?? p.id}/`,
      company: p.project ?? p.name ?? "DeFi Protocol",
      logoUrl: p.logo ?? p.icon ?? undefined,
      type: "BUG_BOUNTY" as ExternalBountyType,
      tags: ["security", "web3", "defi", ...(p.ecosystem ? [p.ecosystem] : [])],
      isOpen: p.status === "active" || p.active !== false,
      rewardMin: undefined,
      rewardMax: maxPayout ? usdToCents(maxPayout) : undefined,
      rewardLabel: maxPayout ? `Up to $${Number(maxPayout).toLocaleString()}` : undefined,
      currency: "USD",
    };
  });
}

/** Gitcoin — grants & ecosystem funding rounds */
async function fetchGitcoin(): Promise<BountyRecord[]> {
  const url =
    "https://grants-stack-indexer-v2.gitcoin.co/api/v1/rounds?first=50&orderBy=createdAt&orderDirection=desc&chainIds=1,10,137,42161";
  let data: any;
  try {
    data = await safeFetch(url);
  } catch (e) {
    console.warn("[gitcoin] fetch failed:", (e as Error).message);
    return [];
  }
  const rounds: any[] = data?.rounds ?? data?.data ?? (Array.isArray(data) ? data : []);
  return rounds
    .filter((r: any) => r.roundEndTime && new Date(r.roundEndTime * 1000) > new Date())
    .slice(0, 50)
    .map((r: any) => {
      const matchPool = r.matchAmount ?? r.matchAmountInUsd ?? 0;
      const poolUsd = typeof matchPool === "string" ? parseFloat(matchPool) : matchPool;
      return {
        source: "GITCOIN" as ExternalBountySource,
        externalId: `${r.chainId}-${r.id}`,
        title: r.roundMetadata?.name ?? r.name ?? "Gitcoin Grant Round",
        description: (r.roundMetadata?.description ?? "Ecosystem grant round on Gitcoin.").slice(0, 500),
        url: `https://explorer.gitcoin.co/#/round/${r.chainId}/${r.id}`,
        company: r.project?.metadata?.title ?? "Gitcoin",
        logoUrl: r.project?.metadata?.logoImg
          ? `https://ipfs.io/ipfs/${r.project.metadata.logoImg}`
          : undefined,
        type: "GRANT" as ExternalBountyType,
        tags: ["grant", "web3", "gitcoin"],
        isOpen: true,
        rewardMin: undefined,
        rewardMax: poolUsd > 0 ? usdToCents(poolUsd) : undefined,
        rewardLabel: poolUsd > 0 ? `$${Math.round(poolUsd).toLocaleString()} pool` : undefined,
        currency: "USD",
        deadline: r.roundEndTime ? new Date(r.roundEndTime * 1000) : undefined,
      };
    });
}

// ─── Batch upsert ─────────────────────────────────────────────────────────────

async function upsertBatch(records: BountyRecord[]): Promise<number> {
  let count = 0;
  for (const r of records) {
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
      console.error(`[upsert] failed for ${r.source}/${r.externalId}:`, (e as Error).message);
    }
  }
  return count;
}

// ─── Cron handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (or allow internal dev calls)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, { fetched: number; upserted: number; error?: string }> = {};

  // Run all fetchers in parallel
  const [algora, issuehunt, hackerone, intigriti, immunefi, gitcoin] = await Promise.allSettled([
    fetchAlgora(),
    fetchIssueHunt(),
    fetchHackerOne(),
    fetchIntigriti(),
    fetchImmunefi(),
    fetchGitcoin(),
  ]);

  const fetchers = [
    { name: "algora",    result: algora },
    { name: "issuehunt", result: issuehunt },
    { name: "hackerone", result: hackerone },
    { name: "intigriti", result: intigriti },
    { name: "immunefi",  result: immunefi },
    { name: "gitcoin",   result: gitcoin },
  ];

  let totalUpserted = 0;

  for (const { name, result } of fetchers) {
    if (result.status === "fulfilled") {
      const records = result.value;
      const upserted = await upsertBatch(records);
      results[name] = { fetched: records.length, upserted };
      totalUpserted += upserted;
    } else {
      results[name] = { fetched: 0, upserted: 0, error: result.reason?.message };
    }
  }

  console.log("[sync-bounties] done:", totalUpserted, "upserted");

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    totalUpserted,
    results,
  });
}
