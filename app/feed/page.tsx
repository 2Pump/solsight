import { SignalCard, type SignalCardData } from "@/components/dashboard/signal-card";
import { prisma } from "@/lib/prisma";
import { formatSymbol, FEED_SIGNAL_CAP } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { Radar } from "lucide-react";

export const metadata = { title: "Live Signal Feed" };

// Server component — queries the database directly on each request.
// `revalidate = 0` keeps this feed live rather than statically cached,
// since new signals can land at any time.
export const revalidate = 0;

type SignalWithTokenAndVotes = Prisma.SignalGetPayload<{
  include: {
    token: {
      select: {
        symbol: true;
        mintAddress: true;
        priceUsd: true;
        priceChange24h: true;
        liquidityUsd: true;
        lpLocked: true;
        lpBurned: true;
        updatedAt: true;
      };
    };
    votes: { select: { value: true; userId: true } };
  };
}>;

async function getSignals(currentUserId: string | null): Promise<SignalCardData[]> {
  const signals = await prisma.signal.findMany({
    take: FEED_SIGNAL_CAP,
    orderBy: { createdAt: "desc" },
    include: {
      token: {
        select: {
          symbol: true,
          mintAddress: true,
          priceUsd: true,
          priceChange24h: true,
          liquidityUsd: true,
          lpLocked: true,
          lpBurned: true,
          updatedAt: true,
        },
      },
      votes: { select: { value: true, userId: true } },
    },
  });

  return signals.map((s: SignalWithTokenAndVotes) => {
    const myVote = currentUserId
      ? s.votes.find((v: { value: number; userId: string }) => v.userId === currentUserId)
      : undefined;
    return {
      id: s.id,
      tokenSymbol: formatSymbol(s.token.symbol),
      tokenMint: s.token.mintAddress,
      type: s.type,
      headline: s.headline,
      reasoning: s.reasoning,
      qualityScore: s.qualityScore,
      riskLevel: s.riskLevel,
      createdAt: s.createdAt.toISOString(),
      votes: s.votes.reduce((sum: number, v: { value: number }) => sum + v.value, 0),
      userVote: (myVote?.value as 1 | -1 | undefined) ?? 0,
      priceUsd: s.token.priceUsd,
      priceChange24h: s.token.priceChange24h,
      liquidityUsd: s.token.liquidityUsd,
      lpLocked: s.token.lpLocked,
      lpBurned: s.token.lpBurned,
      tokenUpdatedAt: s.token.updatedAt.toISOString(),
    };
  });
}

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const currentUserId = (session.user as { id: string }).id;
  const signals = await getSignals(currentUserId);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Live Signal Feed</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Every signal is machine-generated, community-voted, and fully explainable.
            </p>
          </div>
          <p className="text-xs text-ink-faint">
            Showing the {signals.length} most recent signals — older ones roll off automatically as
            new ones come in.
          </p>
        </div>

        {signals.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 py-16 text-center">
            <Radar className="h-8 w-8 text-ink-faint" />
            <p className="text-sm text-ink-muted">
              No signals yet. The trending-token discovery job runs every 30 minutes and creates a
              signal for each new token it finds — check back shortly, or run{" "}
              <code className="text-signal-soft">npm run db:seed</code> for sample data in the
              meantime.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {signals.map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
