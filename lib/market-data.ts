/**
 * Thin wrappers around Birdeye and Dexscreener. Both return normalized
 * shapes so the rest of the app never has to care which provider answered.
 * Birdeye is preferred (requires BIRDEYE_API_KEY); Dexscreener is the
 * public, keyless fallback used when Birdeye is unavailable or rate-limited.
 */

const BIRDEYE_BASE = "https://public-api.birdeye.so";
const DEXSCREENER_BASE = process.env.DEXSCREENER_BASE_URL ?? "https://api.dexscreener.com";

export interface TokenOverview {
  mintAddress: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  priceChange1h: number | null;
  priceChange24h: number | null;
}

export async function getTokenOverview(mintAddress: string): Promise<TokenOverview | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch(`${BIRDEYE_BASE}/defi/token_overview?address=${mintAddress}`, {
        headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        return {
          mintAddress,
          symbol: d.symbol,
          name: d.name,
          imageUrl: d.logoURI ?? null,
          priceUsd: d.price ?? null,
          marketCapUsd: d.mc ?? null,
          liquidityUsd: d.liquidity ?? null,
          volume24hUsd: d.v24hUSD ?? null,
          priceChange1h: d.priceChange1hPercent ?? null,
          priceChange24h: d.priceChange24hPercent ?? null,
        };
      }
    } catch {
      // fall through to Dexscreener
    }
  }

  // Dexscreener fallback — no API key required
  const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${mintAddress}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const pair = json.pairs?.[0];
  if (!pair) return null;

  return {
    mintAddress,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    imageUrl: pair.info?.imageUrl ?? null,
    priceUsd: Number(pair.priceUsd) || null,
    marketCapUsd: pair.fdv ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    volume24hUsd: pair.volume?.h24 ?? null,
    priceChange1h: pair.priceChange?.h1 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,
  };
}

export interface TokenSearchResult {
  mintAddress: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: number | null;
}

/**
 * Search for Solana tokens by symbol or name via Dexscreener's public
 * search endpoint (no API key required). Used to power the "look up a
 * token" search bar — resolves something like "BONK" to its real mint
 * address so users don't need to already know it.
 */
export async function searchTokens(query: string): Promise<TokenSearchResult[]> {
  if (!query.trim()) return [];

  const res = await fetch(
    `${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return [];

  const json = await res.json();
  const pairs: Array<Record<string, unknown>> = json.pairs ?? [];

  const seen = new Set<string>();
  const results: TokenSearchResult[] = [];

  for (const pair of pairs) {
    if (pair.chainId !== "solana") continue;
    const baseToken = pair.baseToken as { address: string; symbol: string; name: string };
    if (!baseToken?.address || seen.has(baseToken.address)) continue;
    seen.add(baseToken.address);

    results.push({
      mintAddress: baseToken.address,
      symbol: baseToken.symbol,
      name: baseToken.name,
      imageUrl: (pair.info as { imageUrl?: string } | undefined)?.imageUrl ?? null,
      priceUsd: pair.priceUsd ? Number(pair.priceUsd) : null,
    });

    if (results.length >= 8) break;
  }

  return results;
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getCandles(
  mintAddress: string,
  timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" = "15m"
): Promise<Candle[]> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return [];

  // Birdeye's OHLCV "type" values use uppercase for hour/day/week/month
  // granularities (1H, 1D) but lowercase for minutes (1m, 15m) — this maps
  // our simpler lowercase timeframe values to what their API actually expects.
  const typeMap: Record<string, string> = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1H",
    "4h": "4H",
    "1d": "1D",
  };

  const now = Math.floor(Date.now() / 1000);
  const from = now - 60 * 60 * 24 * 3; // last 3 days

  const res = await fetch(
    `${BIRDEYE_BASE}/defi/v3/ohlcv?address=${mintAddress}&type=${typeMap[timeframe]}&currency=usd&time_from=${from}&time_to=${now}`,
    { headers: { "X-API-KEY": apiKey, "x-chain": "solana" }, next: { revalidate: 30 } }
  );
  if (!res.ok) {
    console.error(`[birdeye] getCandles failed: ${res.status} ${res.statusText}`);
    return [];
  }
  const json = await res.json();

  return (json.data?.items ?? []).map((c: Record<string, number>) => ({
    time: c.unixTime,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
    volume: c.v,
  }));
}

/**
 * Very small heuristic rug-risk scorer used as a rules-engine fallback when
 * a fuller on-chain audit hasn't run yet. Returns 0 (safe) – 100 (risky).
 * Real deployments should replace/augment this with a dedicated screener
 * (e.g. RugCheck, Bubblemaps, or a custom Helius-based holder analysis job).
 */
export function heuristicRugScore(input: {
  liquidityUsd: number | null;
  topHolderPct: number | null;
  lpLocked: boolean | null;
  mintAuthorityRevoked: boolean | null;
}): number {
  let score = 0;
  if (!input.lpLocked) score += 30;
  if (!input.mintAuthorityRevoked) score += 25;
  if ((input.liquidityUsd ?? 0) < 5000) score += 20;
  if ((input.topHolderPct ?? 0) > 40) score += 25;
  return Math.min(100, score);
}