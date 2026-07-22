import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeChart } from "@/lib/anthropic";
import { getCandles, getTokenOverview, heuristicRugScore } from "@/lib/market-data";

const bodySchema = z.object({
  mintAddress: z.string().min(32).max(44),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).default("15m"),
});

/**
 * POST /api/analyze — fetches recent candles + on-chain overview for a token
 * and asks Claude to produce a structured, explainable chart read.
 * Rate-limit this route in production; it's the most expensive endpoint in the app.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { mintAddress, timeframe } = parsed.data;

  const [overview, candles] = await Promise.all([
    getTokenOverview(mintAddress),
    getCandles(mintAddress, timeframe),
  ]);

  if (!overview) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  if (candles.length < 10) {
    return NextResponse.json(
      { error: "Not enough chart history yet for a reliable read" },
      { status: 422 }
    );
  }

  const rugScore = heuristicRugScore({
    liquidityUsd: overview.liquidityUsd,
    topHolderPct: null,
    lpLocked: null,
    mintAuthorityRevoked: null,
  });

  const analysis = await analyzeChart({
    symbol: overview.symbol,
    candles: candles.map((c) => ({
      timeframe,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      timestamp: c.time,
    })),
    rugScore,
    liquidityUsd: overview.liquidityUsd,
    holderCount: null,
    topHolderPct: null,
  });

  return NextResponse.json({ overview, analysis });
}
