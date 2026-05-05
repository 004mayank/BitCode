import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";

// PATCH /api/jobs/[id]/candidates — update a candidate's status or HR notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { postedById: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.postedById !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { candidateId, status, hrNotes } = body;
  if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });

  const updated = await prisma.jobCandidate.update({
    where: { id: candidateId },
    data: {
      ...(status   ? { status }   : {}),
      ...(hrNotes !== undefined ? { hrNotes } : {}),
    },
  });

  return NextResponse.json({ candidate: updated });
}
