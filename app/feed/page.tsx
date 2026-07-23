import { SignalCard, type SignalCardData } from "@/components/dashboard/signal-card";
import { prisma } from "@/lib/prisma";
import { Radar } from "lucide-react";

export const metadata = { title: "Live Signal Feed" };

// Server component — queries the database directly on each request.
// `revalidate = 0` keeps this feed live rather than statically cached,
// since new signals can land at any time.
export const revalidate = 0;

async function getSignals(): Promise<SignalCardData[]> {
  const signals = await prisma.signal.findMany({
    take: 30,
    orderBy: { createdAt: "desc" },
    include: {
      token: { select: { symbol: true, mintAddress: true } },
      votes: { select: { value: true } },
    },
  });

  return signals.map((s) => ({
    id: s.id,
    tokenSymbol: `$${s.token.symbol}`,
    tokenMint: s.token.mintAddress,
    type: s.type,
    headline: s.headline,
    reasoning: s.reasoning,
    qualityScore: s.qualityScore,
    riskLevel: s.riskLevel,
    createdAt: s.createdAt.toISOString(),
    votes: s.votes.reduce((sum, v) => sum + v.value, 0),
  }));
}

export default async function FeedPage() {
  const signals = await getSignals();

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative py-10">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-semibold text-ink">Live Signal Feed</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Every signal is machine-generated, community-voted, and fully explainable.
          </p>
        </div>

        {signals.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 py-16 text-center">
            <Radar className="h-8 w-8 text-ink-faint" />
            <p className="text-sm text-ink-muted">
              No signals yet. Run <code className="text-signal-soft">npm run db:seed</code> to add
              sample data, or wait for the background job to generate real ones.
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