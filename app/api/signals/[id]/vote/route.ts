import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

/**
 * POST /api/signals/[id]/vote — upvote, downvote, or clear (value: 0) a
 * vote on a signal. Requires auth.
 *
 * Hard-capped to one vote per user per TOKEN, not per signal — a token can
 * accumulate multiple signals over time (each discovery event, breakout,
 * etc. creates its own Signal row), and without this a user could vote
 * once per signal and effectively vote many times on the same token. The
 * schema's unique constraint is only (signalId, userId), so this is
 * enforced here at the application level: before voting on a signal, check
 * whether the user already has a vote on any *other* signal for the same
 * token and block it if so.
 */
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

  const signal = await prisma.signal.findUnique({
    where: { id: signalId },
    select: { tokenId: true },
  });
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 });
  }

  const existingVoteOnToken = await prisma.signalVote.findFirst({
    where: { userId, signal: { tokenId: signal.tokenId } },
    select: { id: true, signalId: true },
  });

  if (existingVoteOnToken && existingVoteOnToken.signalId !== signalId) {
    return NextResponse.json(
      { error: "You've already voted on this token — one vote per token, on any of its signals." },
      { status: 409 }
    );
  }

  if (parsed.data.value === 0) {
    // Clear the vote entirely (toggling off).
    await prisma.signalVote.deleteMany({ where: { signalId, userId } });
  } else {
    await prisma.signalVote.upsert({
      where: { signalId_userId: { signalId, userId } },
      update: { value: parsed.data.value },
      create: { signalId, userId, value: parsed.data.value },
    });
  }

  const total = await prisma.signalVote.aggregate({
    where: { signalId },
    _sum: { value: true },
  });

  return NextResponse.json({ totalVotes: total._sum.value ?? 0 });
}
