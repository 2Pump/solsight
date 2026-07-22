import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatUsd, formatCompact, formatPct, cn } from "@/lib/utils";

export interface TokenCardData {
  mintAddress: string;
  symbol: string;
  name: string;
  imageUrl?: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  marketCapUsd: number | null;
  rugScore: number | null;
}

const RISK_BADGE: Record<string, string> = {
  LOW: "badge-risk-low",
  MEDIUM: "badge-risk-medium",
  HIGH: "badge-risk-high",
  EXTREME: "badge-risk-extreme",
};

function riskLabel(score: number | null): keyof typeof RISK_BADGE {
  if (score === null) return "MEDIUM";
  if (score < 25) return "LOW";
  if (score < 50) return "MEDIUM";
  if (score < 75) return "HIGH";
  return "EXTREME";
}

export function TokenCard({ token }: { token: TokenCardData }) {
  const up = (token.priceChange24h ?? 0) >= 0;
  const risk = riskLabel(token.rugScore);

  return (
    <Link
      href={`/token/${token.mintAddress}`}
      className="glass glass-hover group block p-5"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-2 font-display text-sm font-semibold text-signal-soft">
            {token.symbol.replace("$", "").slice(0, 2)}
          </div>
          <div>
            <div className="font-mono text-sm font-medium text-ink">{token.symbol}</div>
            <div className="text-xs text-ink-faint">{token.name}</div>
          </div>
        </div>
        <span className={RISK_BADGE[risk]}>{risk}</span>
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <div className="font-mono text-lg font-semibold text-ink">
            {formatUsd(token.priceUsd)}
          </div>
          <div
            className={cn(
              "mt-0.5 flex items-center gap-1 text-xs font-medium",
              up ? "text-pulse" : "text-risk"
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPct(token.priceChange24h)}
          </div>
        </div>
        <div className="text-right text-xs text-ink-faint">
          <div>Market Cap</div>
          <div className="font-mono text-ink-muted">{formatCompact(token.marketCapUsd)}</div>
        </div>
      </div>
    </Link>
  );
}
