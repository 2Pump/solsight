import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CandleSummary {
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface ChartAnalysisInput {
  mintAddress: string;
  symbol: string;
  candles: CandleSummary[];
  rugScore: number | null;
  liquidityUsd: number | null;
  holderCount: number | null;
  topHolderPct: number | null;
}

export interface ChartAnalysisResult {
  summary: string;
  bias: "bullish" | "bearish" | "neutral";
  probabilityUp: number; // 0-1, model's own calibrated estimate
  keyLevels: { label: string; price: number }[];
  risks: string[];
}

/**
 * Short-lived in-memory cache for chart analyses, keyed by mint address. AI
 * analysis is the single most expensive call on the token page (unlike
 * Birdeye/Helius reads, which are cheap and read-only), and memecoin
 * traffic clusters hard around whatever's currently trending — so without
 * this, ten different visitors loading the same hot token in the same
 * couple of minutes would each trigger their own full API call for what is,
 * functionally, the same answer. A 5-minute TTL keeps analysis roughly as
 * fresh as the 15m candle timeframe it's built from.
 *
 * This is process-local, same caveat as the Birdeye request gate in
 * market-data.ts — it dedupes traffic hitting the same warm serverless
 * instance, but doesn't share state across instances. If usage grows enough
 * that this starts to matter, move it to the existing Neon Postgres (via
 * Prisma) or a small Redis/Upstash layer for a cache that's shared across
 * every instance instead of per-instance.
 */
const ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;
const analysisCache = new Map<string, { result: ChartAnalysisResult; expiresAt: number }>();

/**
 * Ask Claude to read recent OHLCV candles + on-chain risk signals and produce
 * a structured, human-readable analysis. This is intentionally a *reasoning*
 * layer on top of deterministic data — Claude never invents price data, it
 * only interprets the candles it's given.
 *
 * Uses Haiku rather than Sonnet: this is a bounded, structured-output task
 * (read candles + a handful of on-chain numbers, return fixed-shape JSON) —
 * exactly the kind of high-volume, well-defined job Haiku is priced for
 * ($1/$5 per million tokens vs. Sonnet's $3/$15), not the kind of open-ended
 * reasoning that needs Sonnet's extra capability.
 */
export async function analyzeChart(input: ChartAnalysisInput): Promise<ChartAnalysisResult> {
  const cached = analysisCache.get(input.mintAddress);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const fallback: ChartAnalysisResult = {
    summary: "Analysis unavailable right now — try refreshing in a moment.",
    bias: "neutral",
    probabilityUp: 0.5,
    keyLevels: [],
    risks: ["Analysis temporarily unavailable"],
  };

  const system = `You are a cautious technical analyst for a Solana memecoin dashboard called SolSight.
You will be given recent OHLCV candles and on-chain risk metrics for one token.
Respond ONLY with minified JSON matching this exact shape, no prose, no markdown fences:
{"summary": string (2-3 sentences, plain language, no hype), "bias": "bullish"|"bearish"|"neutral", "probabilityUp": number (0-1), "keyLevels": [{"label": string, "price": number}], "risks": [string]}
Be conservative. If liquidity is thin or holder concentration is high, say so plainly in "risks".
Never give financial advice or tell the user to buy/sell — describe what the data shows.`;

  const user = JSON.stringify({
    symbol: input.symbol,
    candles: input.candles.slice(-120), // cap payload size
    onChain: {
      rugScore: input.rugScore,
      liquidityUsd: input.liquidityUsd,
      holderCount: input.holderCount,
      topHolderPct: input.topHolderPct,
    },
  });

  // The whole API call is wrapped here, not just the JSON parse below — a
  // thrown error from the SDK itself (insufficient credits, rate limit,
  // network failure, anything) previously had nowhere to go and crashed the
  // entire token page in production (surfacing as Next's generic
  // "Application error" digest page, hiding the real cause). AI analysis
  // failing should degrade to a labeled placeholder, never take down a page
  // whose core value (real rug screening, real chart, real RSI) has nothing
  // to do with this one panel.
  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    console.error(`[anthropic] analyzeChart failed for ${input.mintAddress}:`, err);
    return fallback; // not cached — next request gets a fresh real attempt
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";

  let result: ChartAnalysisResult;
  try {
    result = JSON.parse(raw) as ChartAnalysisResult;
  } catch {
    // Fall back to a safe, clearly-labeled default if the model output
    // couldn't be parsed — never let a malformed response break the page.
    // Deliberately NOT cached, so the next request gets a fresh real
    // attempt instead of being stuck serving this placeholder for 5 minutes.
    return fallback;
  }

  analysisCache.set(input.mintAddress, { result, expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS });
  return result;
}
