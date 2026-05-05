import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";

// ─── GitHub API helpers ───────────────────────────────────────────────────────

const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "BitCode/1.0 talent-discovery",
  ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
};

async function ghFetch(path: string): Promise<any> {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  const res = await fetch(url, { headers: GH_HEADERS, signal: AbortSignal.timeout(12_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
  return res.json();
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
// matchScore 0-100:
//   40 pts — skill overlap (repos matched / total repos found, capped)
//   30 pts — GitHub popularity (followers, stars, repos)
//   30 pts — BitCode reputation

function computeMatchScore(
  reposMatched: number,
  totalRepos: number,
  followers: number,
  publicRepos: number,
  bitcodeScore: number,
): number {
  const skillPts = Math.round((Math.min(reposMatched, totalRepos) / Math.max(totalRepos, 1)) * 40);
  const ghPts    = Math.round(Math.min((followers / 500) * 20 + (publicRepos / 50) * 10, 30));
  const bcPts    = Math.round(Math.min((bitcodeScore / 2000) * 30, 30));
  return Math.min(skillPts + ghPts + bcPts, 100);
}

// ─── Discovery endpoint ───────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  // Only the job poster can trigger discovery
  const job = await prisma.job.findUnique({
    where: { id },
    select: { postedById: true, tags: true, title: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.postedById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!job.tags.length) {
    return NextResponse.json({ error: "Add skill tags to the job before discovering candidates" }, { status: 400 });
  }

  // ── Step 1: find relevant GitHub repos via topic search ──────────────────
  // Build query from tags — use top 3 to keep results focused
  const topTags = job.tags.slice(0, 3);
  const searchQuery = topTags.map((t) => `topic:${t}`).join("+");

  let repoData: any = null;
  try {
    repoData = await ghFetch(`/search/repositories?q=${searchQuery}+stars:%3E10&sort=stars&per_page=8`);
  } catch (e) {
    console.error("[discover] repo search failed:", (e as Error).message);
    return NextResponse.json({ error: "GitHub search failed — add a GITHUB_TOKEN for higher rate limits" }, { status: 502 });
  }

  const repos: Array<{ name: string; full_name: string; html_url: string; stargazers_count: number }> =
    repoData?.items?.slice(0, 8) ?? [];

  if (!repos.length) {
    return NextResponse.json({ error: "No matching repositories found for these tags", repos: [] }, { status: 200 });
  }

  // ── Step 2: get contributors for each repo ────────────────────────────────
  // Map: githubLogin → { contributions per repo, repo list }
  const contributorMap = new Map<string, { contributions: number; repos: typeof repos; count: number }>();

  await Promise.allSettled(
    repos.map(async (repo) => {
      try {
        const contributors: any[] = await ghFetch(`/repos/${repo.full_name}/contributors?per_page=30&anon=0`) ?? [];
        for (const c of contributors) {
          if (!c.login || c.type !== "User") continue;
          const existing = contributorMap.get(c.login);
          if (existing) {
            existing.contributions += c.contributions;
            existing.repos.push(repo);
            existing.count++;
          } else {
            contributorMap.set(c.login, { contributions: c.contributions, repos: [repo], count: 1 });
          }
        }
      } catch {
        // skip repo on error
      }
    })
  );

  // ── Step 3: rank candidates ───────────────────────────────────────────────
  // Sort by: repos matched (desc) then contributions (desc), take top 40
  const ranked = [...contributorMap.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.contributions - a.contributions)
    .slice(0, 40);

  // ── Step 4: enrich profiles + check BitCode DB ────────────────────────────
  // Look up all github logins in our DB in one query
  const logins = ranked.map(([login]) => login);
  const bcUsers = await prisma.user.findMany({
    where: { github: { in: logins } },
    select: { id: true, github: true, stats: { select: { reputationPts: true } } },
  });
  const bcMap = new Map(bcUsers.map((u) => [u.github!, u]));

  // Fetch GitHub profiles in batches (rate-limit friendly)
  const profiles: any[] = await Promise.all(
    ranked.map(async ([login]) => {
      try {
        return await ghFetch(`/users/${login}`);
      } catch {
        return null;
      }
    })
  );

  // ── Step 5: upsert JobCandidate rows ─────────────────────────────────────
  let upserted = 0;
  for (let i = 0; i < ranked.length; i++) {
    const [login, meta] = ranked[i];
    const profile = profiles[i];
    if (!profile) continue;

    const bcUser     = bcMap.get(login);
    const bitcodeScore = bcUser?.stats?.reputationPts ?? 0;
    const matchScore   = computeMatchScore(
      meta.count,
      repos.length,
      profile.followers ?? 0,
      profile.public_repos ?? 0,
      bitcodeScore,
    );

    const matchedRepos = meta.repos.map((r) => ({
      name:          r.name,
      url:           r.html_url,
      stars:         r.stargazers_count,
    }));

    try {
      await prisma.jobCandidate.upsert({
        where: { jobId_githubLogin: { jobId: id, githubLogin: login } },
        create: {
          jobId: id,
          githubLogin:  login,
          userId:       bcUser?.id ?? null,
          githubName:   profile.name ?? null,
          githubAvatar: profile.avatar_url ?? null,
          githubBio:    (profile.bio ?? "").slice(0, 300) || null,
          githubUrl:    profile.html_url ?? null,
          followers:    profile.followers ?? 0,
          publicRepos:  profile.public_repos ?? 0,
          matchScore,
          bitcodeScore,
          matchedRepos,
          matchedSkills: meta.repos.flatMap(() => topTags),
          status:       "NEW",
        },
        update: {
          userId:       bcUser?.id ?? null,
          githubName:   profile.name ?? null,
          githubAvatar: profile.avatar_url ?? null,
          githubBio:    (profile.bio ?? "").slice(0, 300) || null,
          githubUrl:    profile.html_url ?? null,
          followers:    profile.followers ?? 0,
          publicRepos:  profile.public_repos ?? 0,
          matchScore,
          bitcodeScore,
          matchedRepos,
          matchedSkills: meta.repos.flatMap(() => topTags),
        },
      });
      upserted++;
    } catch (e) {
      console.error("[discover] upsert failed for", login, (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    reposSearched: repos.length,
    candidatesFound: ranked.length,
    candidatesUpserted: upserted,
    repos: repos.map((r) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count })),
  });
}
