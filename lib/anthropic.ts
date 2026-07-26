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
 * Ask Claude to read recent OHLCV candles + on-chain risk signals and produce
 * a structured, human-readable analysis. This is intentionally a *reasoning*
 * layer on top of deterministic data — Claude never invents price data, it
 * only interprets the candles it's given.
 */
export async function analyzeChart(input: ChartAnalysisInput): Promise<ChartAnalysisResult> {
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

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "{}";

  try {
    return JSON.parse(raw) as ChartAnalysisResult;
  } catch {
    // Fall back to a safe, clearly-labeled default if the model output
    // couldn't be parsed — never let a malformed response break the page.
    return {
      summary: "Analysis unavailable right now — the model response couldn't be parsed.",
      bias: "neutral",
      probabilityUp: 0.5,
      keyLevels: [],
      risks: ["Analysis temporarily unavailable"],
    };
  }
}
