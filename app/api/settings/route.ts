import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Must match the timeframe options the chart switcher actually offers (see
// components/charts/price-chart-panel.tsx's TIMEFRAMES array) — a setting
// for a timeframe the chart can't render would silently do nothing.
const VALID_TIMEFRAMES = ["1s", "1m", "5m", "15m", "1h", "4h", "1d"] as const;

/**
 * GET /api/settings — the signed-in user's settings, creating a default
 * row on first request rather than requiring a separate signup step. Every
 * user eventually needs one of these (the token page reads defaultTimeframe
 * on every visit), so lazily creating it here is simpler than a migration
 * script or a hook on account creation.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  return NextResponse.json({ settings, name: user?.name ?? null });
}

const updateSchema = z.object({
  name: z.string().trim().max(40).optional(),
  defaultTimeframe: z.enum(VALID_TIMEFRAMES).optional(),
  notifyRugWarnings: z.boolean().optional(),
  notifyWalletActivity: z.boolean().optional(),
  notifySignals: z.boolean().optional(),
});

/** PATCH /api/settings — update any subset of the user's settings/display name. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, ...settingsFields } = parsed.data;

  const [settings, user] = await Promise.all([
    prisma.userSettings.upsert({
      where: { userId },
      update: settingsFields,
      create: { userId, ...settingsFields },
    }),
    name !== undefined
      ? prisma.user.update({ where: { id: userId }, data: { name }, select: { name: true } })
      : prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  return NextResponse.json({ settings, name: user?.name ?? null });
}
