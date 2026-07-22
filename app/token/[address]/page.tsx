import { PriceChart } from "@/components/charts/price-chart";
import { AiAnalysisPanel } from "@/components/dashboard/ai-analysis-panel";
import { RiskPanel } from "@/components/dashboard/risk-panel";
import { Button } from "@/components/ui/button";
import { formatCompact, formatUsd, formatPct, shortenAddress } from "@/lib/utils";
import { Star, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Candle } from "@/lib/market-data";

// Deterministic sample candles so the page renders without live API keys.
// In production, replace with `await getCandles(address)` (see lib/market-data.ts).
function sampleCandles(): Candle[] {
  const candles: Candle[] = [];
  let price = 1.2;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 200; i >= 0; i--) {
    const drift = Math.sin(i / 14) * 0.02 + (Math.random() - 0.48) * 0.03;
    const open = price;
    price = Math.max(0.05, price * (1 + drift));
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    candles.push({ time: now - i * 900, open, high, low, close, volume: Math.random() * 500000 });
  }
  return candles;
}

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const candles = sampleCandles();
  const lastPrice = candles[candles.length - 1].close;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-base font-semibold text-signal-soft">
                WF
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">$WIF</h1>
                <div className="flex items-center gap-1.5 font-mono text-xs text-ink-faint">
                  {shortenAddress(address, 6)}
                  <Link href={`https://solscan.io/token/${address}`} target="_blank">
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Star className="h-4 w-4" /> Add to watchlist
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile label="Price" value={formatUsd(lastPrice)} />
          <MetricTile label="24h change" value={formatPct(12.4)} tone="pulse" />
          <MetricTile label="Market cap" value={formatCompact(1_840_000_000)} />
          <MetricTile label="24h volume" value={formatCompact(312_000_000)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            <div className="glass p-4">
              <PriceChart
                candles={candles}
                keyLevels={[
                  { label: "Resistance", price: lastPrice * 1.08 },
                  { label: "Support", price: lastPrice * 0.91 },
                ]}
              />
            </div>
            <AiAnalysisPanel
              analysis={{
                summary:
                  "Price reclaimed the 1h VWAP on above-average volume and is consolidating just under short-term resistance. Structure favors continuation while volume stays elevated, but a rejection here would likely retest support.",
                bias: "bullish",
                probabilityUp: 0.64,
                keyLevels: [
                  { label: "Resistance", price: lastPrice * 1.08 },
                  { label: "Support", price: lastPrice * 0.91 },
                ],
                risks: [
                  "Volume has not yet confirmed a full breakout",
                  "Broader memecoin sector showing mixed momentum today",
                ],
              }}
            />
          </div>

          <div className="flex flex-col gap-6">
            <RiskPanel
              data={{
                rugScore: 8,
                lpLocked: true,
                lpBurned: true,
                mintAuthorityRevoked: true,
                freezeAuthorityRevoked: true,
                topHolderPct: 18.2,
                liquidityUsd: 4_200_000,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pulse" | "risk";
}) {
  return (
    <div className="glass p-4">
      <div className="text-xs text-ink-faint">{label}</div>
      <div
        className={`mt-1 font-mono text-lg font-semibold ${
          tone === "pulse" ? "text-pulse" : tone === "risk" ? "text-risk" : "text-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}