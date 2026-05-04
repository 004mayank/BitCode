import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export const revalidate = 3600; // cache for 1 hour

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type   = searchParams.get("type");   // OSS | BUG_BOUNTY | GRANT
  const source = searchParams.get("source"); // ALGORA | HACKERONE | …
  const q      = searchParams.get("q")?.trim().toLowerCase();
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  const where: any = { isOpen: true };
  if (type)   where.type   = type;
  if (source) where.source = source;

  const [total, bounties] = await Promise.all([
    prisma.externalBounty.count({ where }),
    prisma.externalBounty.findMany({
      where,
      orderBy: [{ fetchedAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        source: true,
        externalId: true,
        title: true,
        description: true,
        url: true,
        company: true,
        logoUrl: true,
        type: true,
        tags: true,
        isOpen: true,
        rewardMin: true,
        rewardMax: true,
        rewardLabel: true,
        currency: true,
        deadline: true,
        fetchedAt: true,
      },
    }),
  ]);

  // If there are no results yet, return helpful meta
  const lastFetch = bounties[0]?.fetchedAt ?? null;

  // Text search filter (post-DB for simplicity; DB is already filtered by type/source)
  const filtered = q
    ? bounties.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.company.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      )
    : bounties;

  return NextResponse.json({
    bounties: filtered,
    total,
    page,
    limit,
    lastSyncedAt: lastFetch,
  });
}
