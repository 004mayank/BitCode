import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";

// ─── GitHub API ───────────────────────────────────────────────────────────────

const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "BitCode/1.0 talent-discovery",
  ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
};

async function ghFetch(path: string, retries = 2): Promise<any> {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: GH_HEADERS, signal: AbortSignal.timeout(12_000) });
    if (res.status === 404) return null;
    if (res.status === 403 || res.status === 429) {
      const reset = res.headers.get("x-ratelimit-reset");
      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining === "0" && attempt < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error(`GitHub rate limited (reset: ${reset})`);
    }
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${url}`);
    return res.json();
  }
}

// ─── Tag -> package name mapping ─────────────────────────────────────────────
// Maps job skill tags to the package names we look for in dependency files.

const TAG_PACKAGES: Record<string, string[]> = {
  langchain:          ["langchain", "langchain-core", "langchain-community", "langchain-openai", "langchain-anthropic"],
  rag:                ["langchain", "llama-index", "llama_index", "haystack-ai", "haystack", "ragas", "llama-cpp-python"],
  llm:                ["openai", "anthropic", "langchain", "transformers", "llama-cpp-python", "groq", "cohere", "mistralai"],
  openai:             ["openai", "langchain-openai"],
  "vector-database":  ["pinecone-client", "pinecone", "weaviate-client", "chromadb", "qdrant-client", "pgvector", "faiss-cpu", "faiss-gpu", "milvus"],
  python:             ["python"],   // presence of .py files (handled separately)
  pytorch:            ["torch", "torchvision", "torchaudio"],
  tensorflow:         ["tensorflow", "keras", "tf-keras"],
  huggingface:        ["transformers", "datasets", "accelerate", "peft", "trl", "diffusers"],
  react:              ["react", "next", "remix-run"],
  typescript:         ["typescript"],
  "machine-learning": ["scikit-learn", "sklearn", "xgboost", "lightgbm", "catboost"],
  "deep-learning":    ["torch", "tensorflow", "keras", "jax", "flax"],
  "computer-vision":  ["opencv-python", "pillow", "torchvision", "ultralytics"],
  nlp:                ["transformers", "spacy", "nltk", "gensim"],
  fastapi:            ["fastapi", "uvicorn", "starlette"],
  "next.js":          ["next"],
  graphql:            ["graphql", "strawberry-graphql", "ariadne"],
};

// Dependency file names to check in each repo
const DEP_FILES = [
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "Pipfile",
  "package.json",
  "conda.yml",
  "environment.yml",
];

// ─── Parse a dependency file for package names ────────────────────────────────

function extractPackages(filename: string, content: string): string[] {
  const found: string[] = [];
  const lower = content.toLowerCase();

  if (filename === "requirements.txt" || filename === "Pipfile" || filename === "conda.yml" || filename === "environment.yml") {
    // One package per line, strip version specifiers
    for (const line of content.split("\n")) {
      const pkg = line.trim().split(/[>=<!~\[;\s]/)[0].toLowerCase();
      if (pkg && !pkg.startsWith("#")) found.push(pkg);
    }
  } else if (filename === "pyproject.toml") {
    // Extract from [tool.poetry.dependencies] or [project] dependencies
    const matches = lower.matchAll(/["']?([\w][\w-]*[\w])["']?\s*[=><~^!]/g);
    for (const m of matches) found.push(m[1]);
  } else if (filename === "setup.py") {
    const matches = lower.matchAll(/["']([\w][\w-]*[\w])["']/g);
    for (const m of matches) found.push(m[1]);
  } else if (filename === "package.json") {
    try {
      const json = JSON.parse(content);
      found.push(...Object.keys(json.dependencies ?? {}));
      found.push(...Object.keys(json.devDependencies ?? {}));
    } catch {}
  }

  return [...new Set(found)];
}

// ─── Scan a candidate's own repos for package usage ──────────────────────────

interface UsageHit {
  repo: string;
  repoUrl: string;
  file: string;
  packagesFound: string[];
}

async function scanCandidateRepos(login: string, targetPackages: string[]): Promise<UsageHit[]> {
  if (!targetPackages.length) return [];

  // Fetch their most recently pushed public repos (up to 15)
  let repos: any[] = [];
  try {
    repos = await ghFetch(`/users/${login}/repos?sort=pushed&per_page=15&type=public`) ?? [];
  } catch {
    return [];
  }

  // Skip forks and empty repos to reduce noise
  const ownRepos = repos.filter((r: any) => !r.fork && r.size > 0).slice(0, 12);

  const hits: UsageHit[] = [];
  const targetSet = new Set(targetPackages.map((p) => p.toLowerCase()));

  await Promise.allSettled(
    ownRepos.map(async (repo: any) => {
      for (const filename of DEP_FILES) {
        try {
          const file = await ghFetch(`/repos/${repo.full_name}/contents/${filename}`);
          if (!file?.content) continue;

          const content = Buffer.from(file.content, "base64").toString("utf8");
          const allPackages = extractPackages(filename, content);
          const matched = allPackages.filter((p) => targetSet.has(p));

          if (matched.length > 0) {
            hits.push({
              repo:          repo.name,
              repoUrl:       repo.html_url,
              file:          filename,
              packagesFound: matched,
            });
            break; // one hit per repo is enough
          }
        } catch {
          // file not found in this repo — expected
        }
      }
    })
  );

  return hits;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
// 100 pts total — transparent breakdown stored per candidate
//
//   35 pts  usageScore      — their OWN repos contain required packages (verified usage)
//   25 pts  ecosystemScore  — contributed to popular repos in the tech space
//   10 pts  popularityScore — GitHub followers / public repos (reach)
//   30 pts  bitcodeScore    — BitCode challenge performance (verified skill, our platform)

function computeScores(
  usageHits: number,         // repos of theirs that contain required packages
  reposMatched: number,      // ecosystem repos they contributed to
  totalEcosystemRepos: number,
  followers: number,
  publicRepos: number,
  bitcodeRawScore: number,
): { matchScore: number; ecosystemScore: number; usageScore: number; popularityScore: number; bitcodeScore: number } {
  // Usage: 35 pts — 1 hit = 20 pts, 2+ hits = 35 pts (diminishing returns)
  const usageScore = usageHits === 0 ? 0 : usageHits === 1 ? 20 : 35;

  // Ecosystem: 25 pts — linear by fraction of searched repos they touched
  const ecosystemScore = Math.round(
    (Math.min(reposMatched, totalEcosystemRepos) / Math.max(totalEcosystemRepos, 1)) * 25
  );

  // Popularity: 10 pts
  const popularityScore = Math.round(
    Math.min((followers / 1000) * 7 + (publicRepos / 100) * 3, 10)
  );

  // BitCode: 30 pts (capped at 2000 raw pts = full score)
  const bitcodeScore = Math.round(Math.min((bitcodeRawScore / 2000) * 30, 30));

  const matchScore = Math.min(usageScore + ecosystemScore + popularityScore + bitcodeScore, 100);

  return { matchScore, ecosystemScore, usageScore, popularityScore, bitcodeScore };
}

// ─── Main discovery handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const job = await prisma.job.findUnique({
    where: { id },
    select: { postedById: true, tags: true, title: true },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.postedById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!job.tags.length) return NextResponse.json({ error: "Add skill tags before discovering" }, { status: 400 });

  // Build the set of packages we're looking for across all tags
  const allTargetPackages = [...new Set(
    job.tags.flatMap((tag) => TAG_PACKAGES[tag.toLowerCase()] ?? [])
  )];

  // ── Step 1: ecosystem repo search ────────────────────────────────────────
  const topTags = job.tags.slice(0, 3);
  const searchQuery = topTags.map((t) => `topic:${t}`).join("+");
  let repoData: any;
  try {
    repoData = await ghFetch(`/search/repositories?q=${searchQuery}+stars:%3E10&sort=stars&per_page=8`);
  } catch (e) {
    return NextResponse.json({ error: `GitHub search failed: ${(e as Error).message}` }, { status: 502 });
  }

  const ecosystemRepos: Array<{ name: string; full_name: string; html_url: string; stargazers_count: number }> =
    repoData?.items?.slice(0, 8) ?? [];

  if (!ecosystemRepos.length) {
    return NextResponse.json({ error: "No matching repositories found for these tags" }, { status: 200 });
  }

  // ── Step 2: collect ecosystem contributors ────────────────────────────────
  const contributorMap = new Map<string, { contributions: number; repos: typeof ecosystemRepos; count: number }>();
  await Promise.allSettled(
    ecosystemRepos.map(async (repo) => {
      try {
        const contributors: any[] = await ghFetch(`/repos/${repo.full_name}/contributors?per_page=30&anon=0`) ?? [];
        for (const c of contributors) {
          if (!c.login || c.type !== "User") continue;
          const ex = contributorMap.get(c.login);
          if (ex) { ex.contributions += c.contributions; ex.repos.push(repo); ex.count++; }
          else     { contributorMap.set(c.login, { contributions: c.contributions, repos: [repo], count: 1 }); }
        }
      } catch {}
    })
  );

  const ranked = [...contributorMap.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.contributions - a.contributions)
    .slice(0, 40);

  // ── Step 3: BitCode lookup ────────────────────────────────────────────────
  const logins = ranked.map(([l]) => l);
  const bcUsers = await prisma.user.findMany({
    where: { github: { in: logins } },
    select: { id: true, github: true, stats: { select: { reputationPts: true } } },
  });
  const bcMap = new Map(bcUsers.map((u) => [u.github!, u]));

  // ── Step 4: fetch GitHub profiles ────────────────────────────────────────
  const profiles = await Promise.all(
    ranked.map(async ([login]) => {
      try { return await ghFetch(`/users/${login}`); } catch { return null; }
    })
  );

  // ── Step 5: scan each candidate's own repos for package usage ────────────
  // Run in small parallel batches to stay within rate limits
  const BATCH = 5;
  const usageResults: UsageHit[][] = new Array(ranked.length).fill([]);

  for (let i = 0; i < ranked.length; i += BATCH) {
    const batch = ranked.slice(i, i + BATCH).map(([login], j) => ({ login, idx: i + j }));
    const results = await Promise.all(
      batch.map(({ login }) => scanCandidateRepos(login, allTargetPackages))
    );
    results.forEach((hits, j) => { usageResults[batch[j].idx] = hits; });
  }

  // ── Step 6: score + upsert ────────────────────────────────────────────────
  let upserted = 0;
  for (let i = 0; i < ranked.length; i++) {
    const [login, meta] = ranked[i];
    const profile   = profiles[i];
    if (!profile) continue;

    const bcUser    = bcMap.get(login);
    const bcRaw     = bcUser?.stats?.reputationPts ?? 0;
    const hits      = usageResults[i];
    const scores    = computeScores(
      hits.length,
      meta.count,
      ecosystemRepos.length,
      profile.followers ?? 0,
      profile.public_repos ?? 0,
      bcRaw,
    );

    const matchedRepos = meta.repos.map((r) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count }));

    try {
      await prisma.jobCandidate.upsert({
        where: { jobId_githubLogin: { jobId: id, githubLogin: login } },
        create: {
          jobId: id, githubLogin: login, userId: bcUser?.id ?? null,
          githubName:   profile.name ?? null,
          githubAvatar: profile.avatar_url ?? null,
          githubBio:    (profile.bio ?? "").slice(0, 300) || null,
          githubUrl:    profile.html_url ?? null,
          followers:    profile.followers ?? 0,
          publicRepos:  profile.public_repos ?? 0,
          ...scores,
          bitcodeScore: bcRaw,
          matchedRepos,
          matchedSkills: topTags,
          usageEvidence: hits as any,
          status: "NEW",
        },
        update: {
          userId:       bcUser?.id ?? null,
          githubName:   profile.name ?? null,
          githubAvatar: profile.avatar_url ?? null,
          githubBio:    (profile.bio ?? "").slice(0, 300) || null,
          githubUrl:    profile.html_url ?? null,
          followers:    profile.followers ?? 0,
          publicRepos:  profile.public_repos ?? 0,
          ...scores,
          bitcodeScore: bcRaw,
          matchedRepos,
          matchedSkills: topTags,
          usageEvidence: hits as any,
        },
      });
      upserted++;
    } catch (e) {
      console.error(`[discover] upsert failed for ${login}:`, (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    reposSearched:       ecosystemRepos.length,
    candidatesFound:     ranked.length,
    candidatesUpserted:  upserted,
    packagesScanned:     allTargetPackages,
    repos: ecosystemRepos.map((r) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count })),
  });
}
