import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";

// GET /api/jobs/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      postedBy: { select: { id: true, name: true, image: true, github: true } },
      candidates: {
        orderBy: { matchScore: "desc" },
        take: 100,
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

// PATCH /api/jobs/[id] — update status or fields (owner only)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const job = await prisma.job.findUnique({ where: { id }, select: { postedById: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.postedById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const updated = await prisma.job.update({
    where: { id },
    data: {
      ...(body.status    ? { status: body.status }       : {}),
      ...(body.title     ? { title: body.title }         : {}),
      ...(body.applyUrl  !== undefined ? { applyUrl: body.applyUrl } : {}),
    },
  });
  return NextResponse.json({ job: updated });
}
