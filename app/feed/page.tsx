import { SignalCard, type SignalCardData } from "@/components/dashboard/signal-card";

export const metadata = { title: "Live Signal Feed" };

// Server component: fetches from /api/signals in production.
// Sample data shown here so the page is meaningful without a seeded DB.
const SIGNALS: SignalCardData[] = [
  {
    id: "1",
    tokenSymbol: "$WIF",
    tokenMint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    type: "BREAKOUT",
    headline: "Reclaimed the 1h VWAP with rising volume",
    reasoning:
      "Price broke back above the 1h volume-weighted average price on the third retest, with volume 2.3x the 6h mean. Structure suggests short-term momentum shift.",
    qualityScore: 92,
    riskLevel: "LOW",
    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    votes: 214,
  },
  {
    id: "2",
    tokenSymbol: "$SLERF",
    tokenMint: "4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs",
    type: "RUG_WARNING",
    headline: "LP unlocked 40 minutes ago, top wallet moving supply",
    reasoning:
      "Liquidity lock expired at 14:02 UTC. The top holder (11.4% of supply) has moved 60% of their balance to a fresh wallet in the last 20 minutes.",
    qualityScore: 88,
    riskLevel: "EXTREME",
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    votes: 341,
  },
  {
    id: "3",
    tokenSymbol: "$MEW",
    tokenMint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
    type: "WHALE_ACCUMULATION",
    headline: "Three wallets that called $WIF early are accumulating",
    reasoning:
      "Wallet cluster #A417 (tagged from prior $WIF entries) has accumulated 1.8M tokens across 6 transactions over the past 3 hours without a corresponding sell.",
    qualityScore: 81,
    riskLevel: "MEDIUM",
    createdAt: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
    votes: 98,
  },
  {
    id: "4",
    tokenSymbol: "$POPCAT",
    tokenMint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    type: "MOMENTUM",
    headline: "Momentum fading, volume down 60% over 2h",
    reasoning:
      "24h volume has declined steadily since the 08:00 UTC peak. No corresponding price breakdown yet, but the divergence is worth watching.",
    qualityScore: 64,
    riskLevel: "MEDIUM",
    createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
    votes: 52,
  },
];

export default function FeedPage() {
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

        <div className="flex flex-col gap-3">
          {SIGNALS.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      </div>
    </div>
  );
}