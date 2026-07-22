import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

  const watchlist = parsed.data.watchlistId
    ? await prisma.watchlist.findFirstOrThrow({
        where: { id: parsed.data.watchlistId, userId },
      })
    : await prisma.watchlist.upsert({
        where: { userId_isDefault: { userId, isDefault: true } as never },
        update: {},
        create: { userId, isDefault: true, name: "My Watchlist" },
      });

  const token = await prisma.token.findUnique({ where: { mintAddress: parsed.data.mintAddress } });
  if (!token) return NextResponse.json({ error: "Token not found — sync it first" }, { status: 404 });

  const item = await prisma.watchlistItem.upsert({
    where: { watchlistId_tokenId: { watchlistId: watchlist.id, tokenId: token.id } },
    update: {},
    create: { watchlistId: watchlist.id, tokenId: token.id },
  });

  return NextResponse.json({ item });
}
