import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Loose Solana base58 address sanity check — same pattern used by the
// wallet search bar. Real validation of "does this address exist and hold
// anything" happens on /wallet/[address] itself, not here.
const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** GET /api/tracked-wallets — the signed-in user's tracked wallets. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const wallets = await prisma.trackedWallet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ wallets });
}

const addSchema = z.object({
  address: z.string().regex(ADDRESS_PATTERN, "That doesn't look like a valid Solana address."),
  label: z.string().trim().max(60).optional(),
});

/** POST /api/tracked-wallets — add a wallet to the user's tracked list. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const wallet = await prisma.trackedWallet.upsert({
    where: { userId_address: { userId, address: parsed.data.address } },
    update: parsed.data.label !== undefined ? { label: parsed.data.label } : {},
    create: { userId, address: parsed.data.address, label: parsed.data.label },
  });

  return NextResponse.json({ wallet });
}

const removeSchema = z.object({ id: z.string() });

/** DELETE /api/tracked-wallets — remove a tracked wallet by its id. */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = removeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Scoped to the requesting user's own id, not just the row id — otherwise
  // any signed-in user could delete any other user's tracked wallet by
  // guessing/reusing an id.
  const result = await prisma.trackedWallet.deleteMany({
    where: { id: parsed.data.id, userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  return NextResponse.json({ removed: true });
}
