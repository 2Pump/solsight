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
  return liquidityUsd !== null && liquidityUsd > MEMECOIN_LIQUIDITY_FALLBACK_CEILING_USD;
}

/**
 * Birdeye's free/dev tier rate limit is tight enough that even two requests
 * fired in the same instant (e.g. getTokenOverview + getCandles kicked off
 * together in a Promise.all) can trip a 429 — this isn't just a "many
 * concurrent calls" problem, it's a "any two at once" problem. Rather than
 * hunting down and re-sequencing every call site that happens to overlap
 * (which is what fixed the RSI panel but left the overview/candles pair
 * exposed), every Birdeye request in this module funnels through this one
 * gate, which chains them into a single-file queue with a small minimum gap
 * between each actual network call. It's process-local — it doesn't help
 * across separate serverless instances — but within one running server it
 * guarantees Birdeye never sees two requests from this app at the same
 * instant, regardless of which functions triggered them or how many call
 * sites exist now or get added later.
 */
// 1100ms rather than something tighter like 250ms: Birdeye's paid Standard
// plan is 50 requests/sec, but free/trial tiers on API platforms like this
// are commonly capped around 1 request/sec — if that's the tier in use
// here, anything faster than ~1s between calls will keep 429ing no matter
// how well-sequenced the calls are. Check the Birdeye dashboard for the
// account's actual plan/RPS limit and tighten this back down once known;
// this value is a conservative placeholder, not a confirmed number.
const BIRDEYE_MIN_GAP_MS = 1100;
let birdeyeQueue: Promise<void> = Promise.resolve();
let lastBirdeyeCallAt = 0;

function withBirdeyeGate<T>(fn: () => Promise<T>): Promise<T> {
  const scheduled = birdeyeQueue.then(async () => {
    const wait = Math.max(0, lastBirdeyeCallAt + BIRDEYE_MIN_GAP_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastBirdeyeCallAt = Date.now();
  });

  // Keep the queue alive even if this call ends up throwing/erroring below —
  // a rejected link in the chain would otherwise permanently jam every
  // Birdeye call queued after it.
  birdeyeQueue = scheduled.catch(() => undefined);

  return scheduled.then(fn);
}

/**
 * Wraps any fetch with a couple of short retries specifically for 429s —
 * honoring a `Retry-After` header if Birdeye sends one, falling back to
 * short exponential backoff otherwise — so a transient rate limit self-heals
 * instead of immediately presenting an empty state. Every actual network
 * attempt (including retries) goes through withBirdeyeGate above, so retries
 * from one call can't collide with a fresh request from another.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, baseDelayMs = 400 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  let lastRes: Response | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await withBirdeyeGate(() => fetch(url, init));
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
      continue;
    }

    if (res.status !== 429) return res;

    lastRes = res;
    if (attempt === retries) break;

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

export interface PrimaryPairInfo {
  pairAddress: string;
  dexId: string;
  /** Real on-chain pool creation time, or null if Dexscreener didn't report one. */
  poolCreatedAt: Date | null;
  buyCount24h: number | null;
  sellCount24h: number | null;
  twitterUrl: string | null;
  telegramUrl: string | null;
  websiteUrl: string | null;
}

/**
 * Finds a token's primary (highest-liquidity) trading pair via Dexscreener's
 * public API — used to identify which DEX/pool holds a token's liquidity,
 * as a prerequisite for on-chain LP burn verification (see
 * getRaydiumPoolLpInfo below and lib/helius.ts's checkLpBurnStatus).
 * Dexscreener's official API doesn't expose lock/burn status itself, only
 * pair identity — the actual burn check happens separately.
 *
 * Also surfaces a few other real fields Dexscreener already returns in this
 * same response (pool creation time, 24h buy/sell counts, social/website
 * links) — pulled out here rather than in a second call, since fetching
 * this response twice for the same token would be wasteful.
 */
export async function getPrimaryPairInfo(mintAddress: string): Promise<PrimaryPairInfo | null> {
  const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${mintAddress}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;

  const json = await res.json();
  const pairs: Array<Record<string, unknown>> = json.pairs ?? [];
  if (pairs.length === 0) return null;

  const sorted = [...pairs].sort((a, b) => {
    const aLiq = ((a.liquidity as { usd?: number } | undefined)?.usd) ?? 0;
    const bLiq = ((b.liquidity as { usd?: number } | undefined)?.usd) ?? 0;
    return bLiq - aLiq;
  });

  const top = sorted[0];
  if (!top?.pairAddress || !top?.dexId) return null;

  const txns24h = (top.txns as { h24?: { buys?: number; sells?: number } } | undefined)?.h24;
  const socials = (top.info as { socials?: Array<{ type: string; url: string }> } | undefined)?.socials ?? [];
  const websites = (top.info as { websites?: Array<{ url: string }> } | undefined)?.websites ?? [];

  return {
    pairAddress: String(top.pairAddress),
    dexId: String(top.dexId),
    poolCreatedAt: typeof top.pairCreatedAt === "number" ? new Date(top.pairCreatedAt) : null,
    buyCount24h: typeof txns24h?.buys === "number" ? txns24h.buys : null,
    sellCount24h: typeof txns24h?.sells === "number" ? txns24h.sells : null,
    twitterUrl: socials.find((s) => s.type === "twitter")?.url ?? null,
    telegramUrl: socials.find((s) => s.type === "telegram")?.url ?? null,
    websiteUrl: websites[0]?.url ?? null,
  };
}

export interface RaydiumPoolLpInfo {
  lpMint: string | null;
  poolType: string | null;
}

export async function getRaydiumPoolLpInfo(pairAddress: string): Promise<RaydiumPoolLpInfo> {
  try {
    const res = await fetch(
      `https://api-v3.raydium.io/pools/info/ids?ids=${pairAddress}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return { lpMint: null, poolType: null };

    const json = await res.json();
    if (json.success === false) return { lpMint: null, poolType: null };

    const pool = json.data?.[0];
    if (!pool) return { lpMint: null, poolType: null };

    return {
      lpMint: pool.lpMint?.address ?? pool.lpMint ?? null,
      poolType: pool.type ?? null,
    };
  } catch (err) {
    console.error(`[raydium] getRaydiumPoolLpInfo threw for ${pairAddress}:`, err);
    return { lpMint: null, poolType: null };
  }
}

export interface TokenSearchResult {
  mintAddress: string;
  symbol: string;
  name: string;
  imageUrl: string | null;
  priceUsd: number | null;
}

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

export type CandleTimeframe = "1s" | "1m" | "5m" | "15m" | "1h" | "2h" | "4h" | "12h" | "1d";

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
    "2h": "2H",
    "4h": "4H",
    "12h": "12H",
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
    "2h": 60 * 60 * 24 * 21, // 21 days — enough 2h candles for a 14-period RSI
    "4h": 60 * 60 * 24 * 30, // 30 days
    "12h": 60 * 60 * 24 * 60, // 60 days — enough 12h candles for a 14-period RSI
    "1d": 60 * 60 * 24 * 180, // 180 days
  };

  const now = Math.floor(Date.now() / 1000);
  const from = now - lookbackSeconds[timeframe];

  const res = await fetchWithRetry(
    `${BIRDEYE_BASE}/defi/v3/ohlcv?address=${mintAddress}&type=${typeMap[timeframe]}&currency=usd&time_from=${from}&time_to=${now}`,
    { headers: { "X-API-KEY": apiKey, "x-chain": "solana" }, next: { revalidate: 30 } }
  );
  if (!res.ok) {
    // Log the actual response body on top of status/statusText — Birdeye's
    // 429 body usually names the specific limit that was hit (a per-second
    // rate vs. a monthly quota are different problems with different
    // fixes), and status/statusText alone can't distinguish them. Also log
    // any rate-limit headers, since the body message alone can be too
    // generic ("Too many requests") to tell which kind of limit this is.
    const body = await res.text().catch(() => "<no body>");
    const rateLimitHeaders = Object.fromEntries(
      [...res.headers.entries()].filter(([key]) => key.toLowerCase().includes("rate") || key.toLowerCase().includes("retry"))
    );
    console.error(
      `[birdeye] getCandles failed: ${res.status} ${res.statusText} — ${body} — headers: ${JSON.stringify(rateLimitHeaders)}`
    );
    return [];
  }
  const json = await res.json();

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

export function heuristicRugScore(input: {
  liquidityUsd: number | null;
  topHolderPct: number | null;
  lpLocked: boolean | null;
  mintAuthorityRevoked: boolean | null;
  /** Real 24h counts from Dexscreener. Optional — older call sites that
   *  don't have this data yet still work, just without this factor. */
  buyCount24h?: number | null;
  sellCount24h?: number | null;
}): number {
  let score = 0;
  if (!input.lpLocked) score += 30;
  if (!input.mintAuthorityRevoked) score += 25;
  if ((input.liquidityUsd ?? 0) < 5000) score += 20;
  if ((input.topHolderPct ?? 0) > 40) score += 25;

  // Severe sell-skew is a real, verifiable signal — but a deliberately soft
  // one (+10, not +25 like the others). Heavy selling can mean holders
  // dumping on a failing token, but it can just as easily mean profit-
  // taking after a healthy pump — the same pattern, two very different
  // situations this data alone can't distinguish. Only counted when there's
  // enough volume for the ratio to be meaningful, not on a handful of txns.
  const buys = input.buyCount24h ?? 0;
  const sells = input.sellCount24h ?? 0;
  if (buys + sells >= 20 && sells > buys * 2) score += 10;

  return Math.min(100, score);
}
