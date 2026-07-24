import { NextRequest, NextResponse } from "next/server";
import { getCandles, type CandleTimeframe } from "@/lib/market-data";

const VALID_TIMEFRAMES: CandleTimeframe[] = ["1s", "1m", "5m", "15m", "1h", "4h", "1d"];

/**
 * GET /api/tokens/[address]/candles?timeframe=1m — used by the timeframe
 * switcher on the token detail page to fetch a new candle set without a
 * full page reload. The initial timeframe is still fetched server-side in
 * the page itself; this only handles subsequent client-side switches.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const requested = req.nextUrl.searchParams.get("timeframe") ?? "15m";

  if (!VALID_TIMEFRAMES.includes(requested as CandleTimeframe)) {
    return NextResponse.json(
      { error: `Invalid timeframe. Must be one of: ${VALID_TIMEFRAMES.join(", ")}` },
      { status: 400 }
    );
  }

  const candles = await getCandles(address, requested as CandleTimeframe);
  return NextResponse.json({ candles });
}