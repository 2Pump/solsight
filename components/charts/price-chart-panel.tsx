"use client";

import { useState } from "react";
import { PriceChart } from "@/components/charts/price-chart";
import { Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Candle, CandleTimeframe } from "@/lib/market-data";

interface KeyLevel {
  label: string;
  price: number;
}

const TIMEFRAMES: { value: CandleTimeframe; label: string }[] = [
  { value: "1s", label: "1s" },
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
];

/**
 * Client wrapper around PriceChart that adds a timeframe switcher. The
 * initial timeframe's candles are fetched server-side (in the token page)
 * and passed in as `initialCandles` — switching timeframes after that
 * fetches from /api/tokens/[address]/candles on demand, so we're not
 * paying for every timeframe's API call on every page load, only the ones
 * someone actually looks at.
 */
export function PriceChartPanel({
  mintAddress,
  initialTimeframe,
  initialCandles,
  keyLevels = [],
}: {
  mintAddress: string;
  initialTimeframe: CandleTimeframe;
  initialCandles: Candle[];
  keyLevels?: KeyLevel[];
}) {
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(initialTimeframe);
  const [candles, setCandles] = useState<Candle[]>(initialCandles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(tf: CandleTimeframe) {
    if (tf === timeframe) return;
    setTimeframe(tf);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tokens/${mintAddress}/candles?timeframe=${tf}`
      );
      if (!res.ok) {
        setError("Couldn't load that timeframe — try again.");
        return;
      }
      const data = await res.json();
      setCandles(data.candles ?? []);
    } catch {
      setError("Couldn't load that timeframe — try again.");
    } finally {
      setLoading(false);
    }
  }

  const hasEnoughHistory = candles.length >= 10;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => handleSelect(tf.value)}
            disabled={loading}
            className={cn(
              "rounded-lg px-2.5 py-1 font-mono text-xs font-medium transition-colors",
              tf.value === timeframe
                ? "bg-signal text-white"
                : "text-ink-faint hover:bg-white/5 hover:text-ink-muted",
              loading && "opacity-60"
            )}
          >
            {tf.label}
          </button>
        ))}
        {loading && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-ink-faint" />}
      </div>

      {error ? (
        <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-ink-faint">
          <AlertTriangle className="h-6 w-6" />
          {error}
        </div>
      ) : hasEnoughHistory ? (
        <PriceChart
          key={timeframe}
          candles={candles}
          keyLevels={keyLevels}
          showSeconds={timeframe === "1s"}
        />
      ) : (
        <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-sm text-ink-faint">
          <AlertTriangle className="h-6 w-6" />
          Not enough {timeframe} candle history for this token yet.
        </div>
      )}
    </div>
  );
}