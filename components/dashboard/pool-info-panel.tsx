import { ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import type { PrimaryPairInfo } from "@/lib/market-data";

/**
 * Real pool age, 24h buy/sell pressure, and verified social links — all
 * from the same Dexscreener pair response getPrimaryPairInfo already
 * fetches elsewhere on this page, not a second API call.
 */
export function PoolInfoPanel({ pairInfo }: { pairInfo: PrimaryPairInfo | null }) {
  if (!pairInfo) {
    return (
      <div className="glass p-6 text-sm text-ink-faint">
        No pool data available for this token yet.
      </div>
    );
  }

  const { poolCreatedAt, buyCount24h, sellCount24h, twitterUrl, telegramUrl, websiteUrl } = pairInfo;
  const hasBuySell = buyCount24h !== null || sellCount24h !== null;
  const totalTx = (buyCount24h ?? 0) + (sellCount24h ?? 0);
  const buyPct = hasBuySell && totalTx > 0 ? ((buyCount24h ?? 0) / totalTx) * 100 : 50;
  const links = [
    twitterUrl && { label: "Twitter", url: twitterUrl },
    telegramUrl && { label: "Telegram", url: telegramUrl },
    websiteUrl && { label: "Website", url: websiteUrl },
  ].filter(Boolean) as { label: string; url: string }[];

  return (
    <div className="glass p-6">
      <h3 className="font-display text-sm font-semibold text-ink">Pool Info</h3>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-muted">Pool created</span>
        <span className="font-mono text-ink">
          {poolCreatedAt ? formatRelativeTime(Math.floor(poolCreatedAt.getTime() / 1000)) : "Unknown"}
        </span>
      </div>

      {hasBuySell && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span className="flex items-center gap-1 text-pulse">
              <TrendingUp className="h-3 w-3" /> {buyCount24h ?? 0} buys
            </span>
            <span className="flex items-center gap-1 text-risk">
              {sellCount24h ?? 0} sells <TrendingDown className="h-3 w-3" />
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-risk/20">
            <div className="h-full rounded-full bg-pulse" style={{ width: `${buyPct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            24h transaction split — a soft signal only. Heavy selling can mean a token failing, or
            just profit-taking after a healthy run; this data alone can't tell those apart.
          </p>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              {link.label} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
