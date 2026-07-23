import { TokenCard, type TokenCardData } from "@/components/dashboard/token-card";
import { TokenSearchBar } from "@/components/dashboard/token-search-bar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// In production this reads the signed-in user's watchlist from Prisma
// (see app/api/watchlist/route.ts). Static sample data here so the page
// renders meaningfully out of the box for new contributors.
const SAMPLE_WATCHLIST: TokenCardData[] = [
  {
    mintAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    symbol: "$WIF",
    name: "dogwifhat",
    priceUsd: 1.84,
    priceChange24h: 12.4,
    marketCapUsd: 1_840_000_000,
    rugScore: 8,
  },
  {
    mintAddress: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    symbol: "$POPCAT",
    name: "Popcat",
    priceUsd: 0.92,
    priceChange24h: -4.1,
    marketCapUsd: 920_000_000,
    rugScore: 14,
  },
  {
    mintAddress: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
    symbol: "$MEW",
    name: "cat in a dogs world",
    priceUsd: 0.0067,
    priceChange24h: 6.8,
    marketCapUsd: 610_000_000,
    rugScore: 19,
  },
  {
    mintAddress: "4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs",
    symbol: "$SLERF",
    name: "Slerf",
    priceUsd: 0.21,
    priceChange24h: -18.9,
    marketCapUsd: 88_000_000,
    rugScore: 71,
  },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">My Watchlist</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {SAMPLE_WATCHLIST.length} tokens tracked · alerts on
          </p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add token
        </Button>
      </div>

      <div className="mb-6">
        <TokenSearchBar />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_WATCHLIST.map((token) => (
          <TokenCard key={token.mintAddress} token={token} />
        ))}
      </div>
    </div>
  );
}