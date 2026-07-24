/**
 * Thin wrappers around Birdeye and Dexscreener. Both return normalized
 * shapes so the rest of the app never has to care which provider answered.
 * Birdeye is preferred (requires BIRDEYE_API_KEY); Dexscreener is the
 * public, keyless fallback used when Birdeye is unavailable or rate-limited.
 */

const BIRDEYE_BASE = "https://public-api.birdeye.so";
const DEXSCREENER_BASE = process.env.DEXSCREENER_BASE_URL ?? "https://api.dexscreener.com";

/**
 * Mint addresses for established, non-memecoin assets (native SOL, major
 * stablecoins, bridged blue-chips, top liquid-staking tokens). SolSight's
 * discovery feed is specifically for memecoin signal intelligence — running
 * these through the same heuristic rug score that's tuned for microcap
 * memecoins produces nonsense results (e.g. WETH getting flagged EXTREME
 * risk because "LP lock status unknown" is scored as if it were a red flag,
 * which it isn't for an asset like this). Denylisted, not analyzed at all.
 *
 * This is a best-effort, manually maintained list — not exhaustive. It
 * catches the common cases seen in Birdeye's trending list; it does not
 * and cannot solve token impersonation (e.g. a scam token cloning a real
 * project's name/symbol with a different mint address) — that needs actual
 * registry verification, which isn't built here.
 */
const BLUE_CHIP_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // Wrapped SOL
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // Wrapped Ether (Wormhole)
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", // Wrapped BTC (Sollet)
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL (Marinade)
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL (Lido)
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
]);

/**
 * Above this real market cap, a token is treated as too large for the kind
 * of discovery this feed is for and skipped, even if not on the explicit
 * denylist above. Deliberately tuned low (not just "exclude obvious
 * blue-chips") — the product goal is surfacing tokens with real 2-5x+
 * upside potential, which shrinks fast as market cap grows: a $500K-cap
 * token doubling needs a fraction of the buying pressure a $50M-cap token
 * would need for the same move. Smaller caps cut both ways (more downside
 * risk too, including to zero) — this ceiling is a discovery filter for
 * upside potential, not a safety guarantee, and pairs with the rug screener
 * for risk assessment on top of it.
 */
const MEMECOIN_MARKET_CAP_CEILING_USD = 15_000_000;

/**
 * Fallback ceiling on liquidity alone, used only when market cap comes back
 * null. Kept in the same spirit as the market cap ceiling above — deep
 * liquidity is itself a sign a token has already grown past the
 * high-upside-potential window this feed targets, regardless of whether
 * Birdeye reported a market cap for it. This also catches WETH/ZEC-style
 * large-caps that previously slipped through when market cap came back
 * unknown and was wrongly treated as "assume it's fine."
 */
const MEMECOIN_LIQUIDITY_FALLBACK_CEILING_USD = 200_000;

export function isBlueChipMint(mintAddress: string): boolean {
  return BLUE_CHIP_MINTS.has(mintAddress);
}

export function isAboveMemecoinMarketCapCeiling(
  marketCapUsd: number | null,
  liquidityUsd: number | null = null
): boolean {
  if (marketCapUsd !== null) return marketCapUsd > MEMECOIN_MARKET_CAP_CEILING_USD;
  // Market cap unknown — fall back to a conservative liquidity check rather
  // than assuming it's safe to treat as a small-cap candidate.
  return liquidityUsd !== null && liquidityUsd > MEMECOIN_LIQUIDITY_FALLBACK_CEILING_USD;
}

/**
 * Birdeye's free/dev tier rate limit is tight enough that a burst of
 * requests (multiple page loads, dev hot-reloads, several users hitting the
 * same 30s revalidate window) can trigger a 429. Previously that surfaced
 * as an empty chart/overview with no explanation. This wraps any fetch with
 * a couple of short retries specifically for 429s — honoring a `Retry-After`
 * header if Birdeye sends one, falling back to short exponential backoff
 * otherwise — so a transient rate limit self-heals instead of immediately
 * presenting an empty state.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 2, baseDelayMs = 400 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  let lastRes: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
      continue;
    }

    if (res.status !== 429) return res;

    lastRes = res;
    if (attempt === retries) break; // out of retries, return the 429 as-is

    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const delay = Number.isFinite(retryAfterMs) ? retryAfterMs : baseDelayMs * 2 ** attempt;
    await sleep(delay);
  }

  return lastRes!;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      const res = await fetchWithRetry(
        `${BIRDEYE_BASE}/defi/token_overview?address=${mintAddress}`,
        { headers: { "X-API-KEY": apiKey, "x-chain": "solana" }, next: { revalidate: 30 } }
      );
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        return {
          mintAddress,
          symbol: d.symbol,
          name: d.name,
          imageUrl: d.logoURI ?? null,
          priceUsd: d.price ?? null,
          // Birdeye's documented response fields are `realMc` (circulating-
          // supply-adjusted market cap) and `marketCap` (fallback) — `mc`
          // is not a real field in their schema. Reading the wrong key here
          // silently returned null for every token, which meant the
          // memecoin market-cap ceiling filter never actually fired (a
          // null market cap was treated as "not above the ceiling," so
          // large-caps like WETH and ZEC slipped through the discovery
          // filter despite the ceiling logic being correct).
          marketCapUsd: d.realMc ?? d.marketCap ?? null,
          liquidityUsd: d.liquidity ?? null,
          volume24hUsd: d.v24hUSD ?? null,
          priceChange1h: d.priceChange1hPercent ?? null,
          priceChange24h: d.priceChange24hPercent ?? null,
        };
      }
      if (res.status === 429) {
        console.error("[birdeye] getTokenOverview rate-limited after retries, falling back to Dexscreener");
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

export interface LpSecurity {
  lpLocked: boolean | null;
  lpBurned: boolean | null;
}

/**
 * Best-effort LP lock/burn check via Birdeye's dedicated Security endpoint
 * (/defi/token_security). Birdeye's exact response schema for this endpoint
 * isn't fully documented publicly, so this checks several plausible field
 * name candidates rather than committing to one guess. If none match, both
 * values stay null ("Unknown") — same honest fallback as before this
 * existed, just with a real chance of getting genuine data when the fields
 * do line up. This endpoint also requires at least a Lite/Starter Birdeye
 * plan; on a lower tier it 403s and this degrades to null the same way.
 */
export async function getLpSecurity(mintAddress: string): Promise<LpSecurity> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return { lpLocked: null, lpBurned: null };

  try {
    const res = await fetchWithRetry(
      `${BIRDEYE_BASE}/defi/token_security?address=${mintAddress}`,
      { headers: { "X-API-KEY": apiKey, "x-chain": "solana" }, next: { revalidate: 300 } }
    );
    if (!res.ok) return { lpLocked: null, lpBurned: null };

    const json = await res.json();
    const d = json.data ?? {};

    const lockedPct: number | undefined =
      d.lockInfo?.percent ?? d.lpLockedPct ?? d.top10LPHolderPercent ?? undefined;
    const burnedPct: number | undefined =
      d.lpBurnedPct ?? d.burnPct ?? d.lockInfo?.burnedPercent ?? undefined;

    return {
      lpLocked: typeof lockedPct === "number" ? lockedPct > 50 : null,
      lpBurned: typeof burnedPct === "number" ? burnedPct > 50 : null,
    };
  } catch (err) {
    console.error(`[birdeye] getLpSecurity threw for ${mintAddress}:`, err);
    return { lpLocked: null, lpBurned: null };
  }
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CandleTimeframe = "1s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export async function getCandles(
  mintAddress: string,
  timeframe: CandleTimeframe = "15m"
): Promise<Candle[]> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return [];

  // Birdeye's OHLCV "type" values use uppercase for hour/day/week/month
  // granularities (1H, 1D) but lowercase for minutes and seconds (1s, 1m,
  // 15m) — this maps our simpler lowercase timeframe values to what their
  // API actually expects.
  const typeMap: Record<CandleTimeframe, string> = {
    "1s": "1s",
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1H",
    "4h": "4H",
    "1d": "1D",
  };

  // Birdeye caps OHLCV responses at 5000 records — a flat 3-day lookback
  // window would ask for ~259,200 candles at 1s granularity, blowing well
  // past that cap (and being pointless to render anyway). Scale the
  // requested window to the timeframe instead.
  const lookbackSeconds: Record<CandleTimeframe, number> = {
    "1s": 60 * 30, // 30 minutes
    "1m": 60 * 60 * 12, // 12 hours
    "5m": 60 * 60 * 24 * 3, // 3 days
    "15m": 60 * 60 * 24 * 3, // 3 days
    "1h": 60 * 60 * 24 * 14, // 14 days
    "4h": 60 * 60 * 24 * 30, // 30 days
    "1d": 60 * 60 * 24 * 180, // 180 days
  };

  const now = Math.floor(Date.now() / 1000);
  const from = now - lookbackSeconds[timeframe];

  const res = await fetchWithRetry(
    `${BIRDEYE_BASE}/defi/v3/ohlcv?address=${mintAddress}&type=${typeMap[timeframe]}&currency=usd&time_from=${from}&time_to=${now}`,
    { headers: { "X-API-KEY": apiKey, "x-chain": "solana" }, next: { revalidate: 30 } }
  );
  if (!res.ok) {
    console.error(`[birdeye] getCandles failed: ${res.status} ${res.statusText}`);
    return [];
  }
  const json = await res.json();

  // Birdeye's v3 OHLCV response doesn't reliably use `unixTime` the way
  // their older v1 endpoint does — every candle's `open`/`high`/`low`/
  // `close`/`volume` mapped correctly, but `time` came through as
  // `undefined` for every single candle, silently failing chart rendering
  // client-side with no server error (the fetch itself succeeds; only this
  // one field is wrong). Rather than guess a single new field name and
  // risk this breaking again on the next Birdeye schema tweak, check the
  // plausible candidates in order.
  return (json.data?.items ?? []).map((c: Record<string, number>) => ({
    time: c.unixTime ?? c.time ?? c.timestamp ?? c.unix_time,
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
    volume: c.v,
  }));
}

export interface TrendingToken {
  mintAddress: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  rank: number;
}

/**
 * Real trending-tokens list from Birdeye, used to auto-discover new tokens
 * for the signal feed instead of leaving it seeded with only a couple of
 * sample rows. Sorted by 24h volume rather than Birdeye's default "rank"
 * (popularity) sort — a lesson learned on a sibling project, where a
 * popularity-ranked trending list surfaced tokens with real trading
 * activity far less often than a volume-sorted one does.
 */
export async function getTrendingTokens(limit = 20): Promise<TrendingToken[]> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return [];

  const res = await fetchWithRetry(
    `${BIRDEYE_BASE}/defi/token_trending?sort_by=volume24hUSD&sort_type=desc&offset=0&limit=${limit}`,
    { headers: { "X-API-KEY": apiKey, "x-chain": "solana" }, next: { revalidate: 300 } }
  );
  if (!res.ok) {
    console.error(`[birdeye] getTrendingTokens failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const json = await res.json();
  const tokens: Array<Record<string, unknown>> = json.data?.tokens ?? [];

  return tokens
    .filter((t) => !isBlueChipMint(String(t.address)))
    .map((t, i) => ({
      mintAddress: String(t.address),
      symbol: String(t.symbol ?? "UNKNOWN"),
      name: String(t.name ?? t.symbol ?? "Unknown token"),
      imageUrl: (t.logoURI as string | undefined) ?? null,
      priceUsd: typeof t.price === "number" ? t.price : null,
      liquidityUsd: typeof t.liquidity === "number" ? t.liquidity : null,
      volume24hUsd: typeof t.volume24hUSD === "number" ? t.volume24hUSD : null,
      rank: i + 1,
    }));
}

/**
 * Very small heuristic rug-risk scorer used as a rules-engine fallback when
 * a fuller on-chain audit hasn't run yet. Returns 0 (safe) – 100 (risky).
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