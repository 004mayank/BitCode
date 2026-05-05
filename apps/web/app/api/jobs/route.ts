import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";

// GET /api/jobs — list open jobs (public)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q")?.trim().toLowerCase();
  const mine   = searchParams.get("mine") === "1";
  const session = await auth();
  const userId  = (session?.user as any)?.id as string | undefined;

  const where: any = mine && userId
    ? { postedById: userId }
    : { status: "OPEN" };

  const jobs = await prisma.job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, createdAt: true, company: true, logoUrl: true,
      title: true, description: true, location: true, remote: true,
      jobType: true, tags: true, salaryMin: true, salaryMax: true,
      currency: true, applyUrl: true, status: true,
      postedBy: { select: { id: true, name: true, image: true } },
      _count: { select: { candidates: true } },
    },
  });

  const filtered = q
    ? jobs.filter((j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.tags.some((t) => t.toLowerCase().includes(q))
      )
    : jobs;

  return NextResponse.json({ jobs: filtered });
}

// POST /api/jobs — create a job (requires auth)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => null);
  if (!body?.title || !body?.company || !body?.description) {
    return NextResponse.json({ error: "title, company, description required" }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      postedById:  userId,
      title:       body.title,
      company:     body.company,
      logoUrl:     body.logoUrl ?? null,
      description: body.description,
      location:    body.location ?? null,
      remote:      body.remote ?? true,
      jobType:     body.jobType ?? "FULL_TIME",
      tags:        Array.isArray(body.tags) ? body.tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
      salaryMin:   body.salaryMin ? Number(body.salaryMin) : null,
      salaryMax:   body.salaryMax ? Number(body.salaryMax) : null,
      currency:    body.currency ?? "USD",
      applyUrl:    body.applyUrl ?? null,
      status:      "OPEN",
    },
  });

  return NextResponse.json({ job }, { status: 201 });
}
