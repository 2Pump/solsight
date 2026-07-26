import { TrendingUp, TrendingDown } from "lucide-react";
import type { TimeframeRsi } from "@/lib/technical-analysis";
import { cn } from "@/lib/utils";

export function RsiPanel({ data }: { data: TimeframeRsi[] }) {
  const hasAny = data.some((d) => d.rsi !== null);
  if (!hasAny) return null;

  return (
    <div className="glass p-5">
      <h3 className="font-display text-sm font-semibold text-ink">Multi-Timeframe RSI</h3>
      <p className="mt-1 text-xs text-ink-faint">
        Real RSI (Wilder's smoothing, 14-period), computed directly from candle closes at each
        timeframe.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {data.map((d) => {
          if (d.rsi === null) {
            return (
              <div
                key={d.timeframe}
                className="flex items-center justify-between rounded-lg border border-border bg-white/5 px-3 py-2 text-xs text-ink-faint"
              >
                <span className="font-mono">{d.timeframe}</span>
                <span>Not enough history yet</span>
              </div>
            );
          }

          const bullish = d.rsi >= 50;
          return (
            <div
              key={d.timeframe}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium",
                bullish ? "bg-signal/15 text-signal-soft" : "bg-risk/15 text-risk"
              )}
            >
              <span className="font-mono">{d.timeframe}</span>
              <span className="flex items-center gap-1.5">
                RSI {bullish ? ">" : "<"} 50
                {d.direction === "rising" && <TrendingUp className="h-3 w-3" />}
                {d.direction === "falling" && <TrendingDown className="h-3 w-3" />}
                <span className="font-mono">{d.rsi.toFixed(1)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}