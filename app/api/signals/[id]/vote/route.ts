import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });

/** POST /api/signals/[id]/vote — upvote or downvote a signal. Requires auth. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id: signalId } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;

  const vote = await prisma.signalVote.upsert({
    where: { signalId_userId: { signalId, userId } },
    update: { value: parsed.data.value },
    create: { signalId, userId, value: parsed.data.value },
  });

  const total = await prisma.signalVote.aggregate({
    where: { signalId },
    _sum: { value: true },
  });

  return NextResponse.json({ vote, totalVotes: total._sum.value ?? 0 });
}
