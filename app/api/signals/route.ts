import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const querySchema = z.object({
  cursor: z.string().optional(),
  take: z.coerce.number().min(1).max(50).default(20),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "EXTREME"]).optional(),
  type: z
    .enum([
      "BREAKOUT",
      "MOMENTUM",
      "WHALE_ACCUMULATION",
      "WHALE_DISTRIBUTION",
      "LIQUIDITY_CHANGE",
      "RUG_WARNING",
      "SOCIAL_SPIKE",
      "NEW_LISTING",
    ])
    .optional(),
});

/** GET /api/signals — public, paginated, filterable live signal feed. */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { cursor, take, riskLevel, type } = parsed.data;

  const signals = await prisma.signal.findMany({
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    where: {
      ...(riskLevel ? { riskLevel } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      token: { select: { symbol: true, mintAddress: true, imageUrl: true } },
      votes: { select: { value: true } },
    },
  });

  const hasMore = signals.length > take;
  const page = hasMore ? signals.slice(0, -1) : signals;

  const data = page.map((s) => ({
    id: s.id,
    tokenSymbol: s.token.symbol,
    tokenMint: s.token.mintAddress,
    tokenImage: s.token.imageUrl,
    type: s.type,
    headline: s.headline,
    reasoning: s.reasoning,
    qualityScore: s.qualityScore,
    riskLevel: s.riskLevel,
    createdAt: s.createdAt.toISOString(),
    votes: s.votes.reduce((sum, v) => sum + v.value, 0),
  }));

  return NextResponse.json({
    data,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
