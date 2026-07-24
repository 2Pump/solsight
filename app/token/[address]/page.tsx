import { PriceChartPanel } from "@/components/charts/price-chart-panel";
import { AiAnalysisPanel } from "@/components/dashboard/ai-analysis-panel";
import { RiskPanel } from "@/components/dashboard/risk-panel";
import { AddToWatchlistButton } from "@/components/dashboard/add-to-watchlist-button";
import { formatCompact, formatUsd, formatPct, formatSymbol, shortenAddress } from "@/lib/utils";
import { ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getTokenOverview, getCandles, heuristicRugScore } from "@/lib/market-data";
import { getMintSafety } from "@/lib/helius";
import { analyzeChart } from "@/lib/anthropic";

export const revalidate = 30; // refresh market data at most every 30s

export default async function TokenDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  // Real market data — falls back from Birdeye to Dexscreener automatically
  // (see lib/market-data.ts). Returns null if the token can't be found on
  // either provider.
  const [overview, candles, mintSafety] = await Promise.all([
    getTokenOverview(address),
    getCandles(address, "15m"),
    getMintSafety(address),
  ]);
  const hasChartHistory = candles.length >= 10;
  const lastPrice = hasChartHistory ? candles[candles.length - 1].close : (overview?.priceUsd ?? null);

  // Real rug-risk heuristic. LP lock/burn status stays "Unknown" — see
  // lib/helius.ts's getMintSafety doc comment for why that's a deliberately
  // separate, bigger feature rather than a faked heuristic. Mint/freeze
  // authority and top-10-holder concentration are now real on-chain reads.
  const rugScore = overview
    ? heuristicRugScore({
        liquidityUsd: overview.liquidityUsd,
        topHolderPct: mintSafety.topHolderPct,
        lpLocked: null,
        mintAuthorityRevoked: mintSafety.mintAuthorityRevoked,
      })
    : null;

  // AI analysis only runs when we have both a real API key and enough
  // chart history to give Claude something meaningful to read.
  const canAnalyze = hasChartHistory && !!process.env.ANTHROPIC_API_KEY && !!overview;
  const analysis = canAnalyze
    ? await analyzeChart({
        symbol: overview!.symbol,
        candles: candles.map((c) => ({
          timeframe: "15m",
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          timestamp: c.time,
        })),
        rugScore,
        liquidityUsd: overview!.liquidityUsd,
        holderCount: null,
        topHolderPct: mintSafety.topHolderPct,
      })
    : null;

  if (!overview) {
    return (
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
        <div className="container relative py-20 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-ink-faint" />
          <h1 className="mt-4 font-display text-xl font-semibold text-ink">
            Couldn't find this token
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            No market data returned for{" "}
            <span className="font-mono text-ink">{shortenAddress(address, 6)}</span>. It may be
            too new, too illiquid, or the address may be incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-base font-semibold text-signal-soft">
                {overview.symbol.replace(/^\$+/, "").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">
                  {formatSymbol(overview.symbol)}
                </h1>
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
            <AddToWatchlistButton mintAddress={address} />
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile label="Price" value={formatUsd(lastPrice)} />
          <MetricTile
            label="24h change"
            value={formatPct(overview.priceChange24h)}
            tone={(overview.priceChange24h ?? 0) >= 0 ? "pulse" : "risk"}
          />
          <MetricTile label="Market cap" value={formatCompact(overview.marketCapUsd)} />
          <MetricTile label="24h volume" value={formatCompact(overview.volume24hUsd)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-6">
            <div className="glass p-4">
             {hasChartHistory ? (
                <PriceChartPanel
                  mintAddress={address}
                  initialTimeframe="15m"
                  initialCandles={candles}
                  keyLevels={
                    analysis
                      ? analysis.keyLevels.map((l) => ({ label: l.label, price: l.price }))
                      : []
                  }
                />
              ) : (
                <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-ink-faint">
                  <AlertTriangle className="h-6 w-6" />
                  No chart history available yet for this token.
                  {!process.env.BIRDEYE_API_KEY && (
                    <span>Set BIRDEYE_API_KEY to enable candlestick charts.</span>
                  )}
                </div>
              )}
            </div>

            {analysis ? (
              <AiAnalysisPanel analysis={analysis} />
            ) : (
              <div className="glass p-6 text-sm text-ink-muted">
                {process.env.ANTHROPIC_API_KEY
                  ? "Not enough chart history yet for a reliable AI read."
                  : "Set ANTHROPIC_API_KEY to enable AI chart analysis."}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <RiskPanel
              data={{
                rugScore: rugScore ?? 50,
                lpLocked: null,
                lpBurned: null,
                mintAuthorityRevoked: mintSafety.mintAuthorityRevoked,
                freezeAuthorityRevoked: mintSafety.freezeAuthorityRevoked,
                topHolderPct: mintSafety.topHolderPct,
                liquidityUsd: overview.liquidityUsd,
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