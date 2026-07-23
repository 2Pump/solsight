import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getTokenOverview } from "@/lib/market-data";

/** GET /api/watchlist — the signed-in user's watchlists with tokens. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const watchlists = await prisma.watchlist.findMany({
    where: { userId },
    include: { items: { include: { token: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ watchlists });
}

const addSchema = z.object({
  watchlistId: z.string().optional(),
  mintAddress: z.string().min(32).max(44),
});

/** POST /api/watchlist — add a token to the user's default (or specified) watchlist. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Resolve the target watchlist: either the one explicitly requested, or
  // the user's default watchlist (created lazily on first use). There's no
  // compound unique constraint on (userId, isDefault) in the schema — a user
  // could in principle end up with more than one row flagged isDefault if
  // this ran concurrently, but for a single-user "add to watchlist" click
  // that's an acceptable tradeoff over adding a schema constraint that would
  // also block a user from ever having two non-default watchlists.
  const watchlist = parsed.data.watchlistId
    ? await prisma.watchlist.findFirstOrThrow({
        where: { id: parsed.data.watchlistId, userId },
      })
    : ((await prisma.watchlist.findFirst({ where: { userId, isDefault: true } })) ??
      (await prisma.watchlist.create({
        data: { userId, isDefault: true, name: "My Watchlist" },
      })));

  const token = await prisma.token.findUnique({ where: { mintAddress: parsed.data.mintAddress } });

  // Token pages pull live market data directly and never persist a row —
  // so "add to watchlist" would 404 on almost every real token. Instead of
  // requiring a separate sync step first, fetch the same real overview data
  // the token page itself uses and upsert it here. Never fabricated: if the
  // provider can't find the token, we say so rather than creating a blank row.
  const resolvedToken =
    token ??
    (await (async () => {
      const overview = await getTokenOverview(parsed.data.mintAddress);
      if (!overview) return null;
      return prisma.token.create({
        data: {
          mintAddress: overview.mintAddress,
          symbol: overview.symbol,
          name: overview.name,
          imageUrl: overview.imageUrl,
          priceUsd: overview.priceUsd,
          marketCapUsd: overview.marketCapUsd,
          liquidityUsd: overview.liquidityUsd,
          volume24hUsd: overview.volume24hUsd,
          priceChange1h: overview.priceChange1h,
          priceChange24h: overview.priceChange24h,
        },
      });
    })());

  if (!resolvedToken) {
    return NextResponse.json(
      { error: "Couldn't find market data for this token — it may be too new or illiquid." },
      { status: 404 }
    );
  }

  const item = await prisma.watchlistItem.upsert({
    where: { watchlistId_tokenId: { watchlistId: watchlist.id, tokenId: resolvedToken.id } },
    update: {},
    create: { watchlistId: watchlist.id, tokenId: resolvedToken.id },
  });

  return NextResponse.json({ item });
}

const removeSchema = z.object({
  mintAddress: z.string().min(32).max(44),
});

/** DELETE /api/watchlist — remove a token from the user's default watchlist. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = removeSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const token = await prisma.token.findUnique({ where: { mintAddress: parsed.data.mintAddress } });
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 404 });

  const watchlist = await prisma.watchlist.findFirst({ where: { userId, isDefault: true } });
  if (!watchlist) return NextResponse.json({ removed: false });

  await prisma.watchlistItem
    .delete({ where: { watchlistId_tokenId: { watchlistId: watchlist.id, tokenId: token.id } } })
    .catch(() => null); // already removed — treat as success, not an error

  return NextResponse.json({ removed: true });
}