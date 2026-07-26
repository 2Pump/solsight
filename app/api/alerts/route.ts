import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** GET /api/alerts — the signed-in user's alerts, with enough token/wallet detail to display them. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const alerts = await prisma.alert.findMany({
    where: { userId },
    include: {
      token: { select: { mintAddress: true, symbol: true, name: true } },
      trackedWallet: { select: { address: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ alerts });
}

// A discriminated union on `type` rather than one loose object: each alert
// type has a genuinely different shape (a token + price level vs. a wallet
// + optional threshold), and this makes it impossible to submit e.g.
// PRICE_ABOVE with a trackedWalletId instead of a mintAddress.
const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PRICE_ABOVE"),
    mintAddress: z.string().min(32).max(44),
    thresholdUsd: z.number().positive(),
  }),
  z.object({
    type: z.literal("PRICE_BELOW"),
    mintAddress: z.string().min(32).max(44),
    thresholdUsd: z.number().positive(),
  }),
  z.object({
    type: z.literal("LARGE_TRANSACTION"),
    trackedWalletId: z.string(),
    thresholdUsd: z.number().positive(),
  }),
  z.object({
    type: z.literal("WALLET_ACTIVITY"),
    trackedWalletId: z.string(),
  }),
]);

/**
 * POST /api/alerts — create an alert. Deliberately does NOT trust a client-
 * supplied tokenId/trackedWalletId as authorization by itself: every alert
 * is validated against rows the requesting user actually owns (a
 * watchlist item for price alerts, a TrackedWallet row for wallet alerts),
 * so this can't be used to create an alert against someone else's tracked
 * wallet or an arbitrary token that isn't really on this user's watchlist.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  if (data.type === "PRICE_ABOVE" || data.type === "PRICE_BELOW") {
    const watchlistItem = await prisma.watchlistItem.findFirst({
      where: { token: { mintAddress: data.mintAddress }, watchlist: { userId } },
      include: { token: true },
    });
    if (!watchlistItem) {
      return NextResponse.json(
        { error: "That token isn't on your watchlist yet — add it first, then create a price alert." },
        { status: 400 }
      );
    }

    const alert = await prisma.alert.create({
      data: {
        userId,
        type: data.type,
        tokenId: watchlistItem.tokenId,
        thresholdUsd: data.thresholdUsd,
      },
      include: {
        token: { select: { mintAddress: true, symbol: true, name: true } },
        trackedWallet: { select: { address: true, label: true } },
      },
    });
    return NextResponse.json({ alert });
  }

  // LARGE_TRANSACTION / WALLET_ACTIVITY — both target a tracked wallet.
  const wallet = await prisma.trackedWallet.findFirst({
    where: { id: data.trackedWalletId, userId },
  });
  if (!wallet) {
    return NextResponse.json(
      { error: "That wallet isn't in your tracked wallets — add it first, then create an alert." },
      { status: 400 }
    );
  }

  const alert = await prisma.alert.create({
    data: {
      userId,
      type: data.type,
      trackedWalletId: wallet.id,
      thresholdUsd: data.type === "LARGE_TRANSACTION" ? data.thresholdUsd : null,
    },
    include: {
      token: { select: { mintAddress: true, symbol: true, name: true } },
      trackedWallet: { select: { address: true, label: true } },
    },
  });
  return NextResponse.json({ alert });
}

const removeSchema = z.object({ id: z.string() });

/** DELETE /api/alerts — remove an alert by its id. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = removeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await prisma.alert.deleteMany({ where: { id: parsed.data.id, userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ removed: true });
}
