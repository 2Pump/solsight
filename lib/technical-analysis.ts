import { getCandles, type Candle } from "@/lib/market-data";

/**
 * Real RSI (Relative Strength Index), computed with Wilder's smoothing —
 * the same method TradingView and virtually every charting platform uses,
 * so the numbers here should line up with what people are used to seeing
 * elsewhere. This is genuine math on real candle closes, not an AI
 * estimate or narration.
 *
 * Returns null if there isn't enough candle history to compute a
 * meaningful value (needs at least `period + 1` closes).
 */
export function computeRSI(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  const closes = candles.map((c) => c.close);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += -change;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for the remaining candles.
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100; // no losses in the window — maximally overbought
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Resamples candles into a coarser timeframe by combining every `factor`
 * consecutive bars into one — standard OHLCV aggregation (first open,
 * highest high, lowest low, last close, summed volume), the same technique
 * every charting platform uses to build higher timeframes from lower ones.
 * Used here so the RSI panel only needs ONE real API call (1H candles)
 * instead of a separate request per timeframe — firing 4 concurrent
 * requests per page load was hammering Birdeye's rate limit and made every
 * token page load noticeably slower (each 429 triggers its own
 * retry-with-backoff delay).
 */
function resampleCandles(candles: Candle[], factor: number): Candle[] {
  const resampled: Candle[] = [];
  for (let i = 0; i + factor <= candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor);
    resampled.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  return resampled;
}

export interface TimeframeRsi {
  timeframe: string;
  rsi: number | null;
  /** Whether RSI is trending up or down over the last few periods — real comparison against RSI a few candles back, not a guess. */
  direction: "rising" | "falling" | null;
}

function rsiWithDirection(candles: Candle[], label: string): TimeframeRsi {
  const rsi = computeRSI(candles);
  let direction: "rising" | "falling" | null = null;
  if (candles.length >= 18 && rsi !== null) {
    const earlierRsi = computeRSI(candles.slice(0, -3));
    if (earlierRsi !== null) direction = rsi >= earlierRsi ? "rising" : "falling";
  }
  return { timeframe: label, rsi, direction };
}

/**
 * Computes real RSI across four timeframes (1H, 2H, 4H, 12H) for one
 * token, using a SINGLE real Birdeye candle fetch (1H, 14-day lookback —
 * 336 candles) and deriving the coarser timeframes by resampling that same
 * data locally. This replaces an earlier version that made 4 separate
 * concurrent API calls, which was overwhelming Birdeye's rate limit.
 */
export async function getMultiTimeframeRsi(mintAddress: string): Promise<TimeframeRsi[]> {
  const hourlyCandles = await getCandles(mintAddress, "1h");

  return [
    rsiWithDirection(hourlyCandles, "1H"),
    rsiWithDirection(resampleCandles(hourlyCandles, 2), "2H"),
    rsiWithDirection(resampleCandles(hourlyCandles, 4), "4H"),
    rsiWithDirection(resampleCandles(hourlyCandles, 12), "12H"),
  ];
}