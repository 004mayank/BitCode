import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { ExternalApplicationStatus } from "@prisma/client";

const VALID_STATUSES = new Set<ExternalApplicationStatus>([
  "SAVED", "APPLIED", "IN_PROGRESS", "SUBMITTED", "WON", "LOST",
]);

// GET /api/external-applications
// Returns all tracked bounties for the signed-in user.
// Optional ?bountyIds=id1,id2 to check specific bounties (for UI hydration).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("bountyIds")?.split(",").filter(Boolean);

  const applications = await prisma.externalApplication.findMany({
    where: {
      userId,
      ...(ids?.length ? { externalBountyId: { in: ids } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      externalBountyId: true,
      status: true,
      submissionUrl: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ applications });
}

// POST /api/external-applications
// Upsert a tracking record for one bounty. Body: { externalBountyId, status, submissionUrl?, notes? }
// DELETE (status=null) to remove tracking.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => null);
  if (!body?.externalBountyId) {
    return NextResponse.json({ error: "externalBountyId required" }, { status: 400 });
  }

  const { externalBountyId, status, submissionUrl, notes } = body as {
    externalBountyId: string;
    status: ExternalApplicationStatus | null;
    submissionUrl?: string;
    notes?: string;
  };

  // null status = delete the tracking record
  if (status === null) {
    await prisma.externalApplication.deleteMany({
      where: { userId, externalBountyId },
    });
    return NextResponse.json({ ok: true, deleted: true });
  }

  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  // Verify the bounty exists
  const bounty = await prisma.externalBounty.findUnique({ where: { id: externalBountyId }, select: { id: true } });
  if (!bounty) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

  const application = await prisma.externalApplication.upsert({
    where: { userId_externalBountyId: { userId, externalBountyId } },
    create: { userId, externalBountyId, status, submissionUrl, notes },
    update: { status, ...(submissionUrl !== undefined ? { submissionUrl } : {}), ...(notes !== undefined ? { notes } : {}) },
  });

  return NextResponse.json({ ok: true, application });
}
