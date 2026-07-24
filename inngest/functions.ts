import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import {
  getTokenOverview,
  getTrendingTokens,
  getPrimaryPairInfo,
  getRaydiumPoolLpInfo,
  heuristicRugScore,
  isAboveMemecoinMarketCapCeiling,
} from "@/lib/market-data";
import { getMintSafety, checkLpBurnStatus } from "@/lib/helius";
import { FEED_SIGNAL_CAP } from "@/lib/utils";

/**
 * Real, verified LP burn check for a token's primary pool.
 *
 * Only covers Raydium Standard (classic constant-product) pools — verified
 * end-to-end against a live pool during testing: Raydium's own public API
 * (api-v3.raydium.io) resolves the pool to its real LP mint, then a plain
 * getTokenSupply RPC call checks whether that mint's supply is zero. A
 * manual earlier attempt at decoding pool accounts by a guessed byte offset
 * was verified WRONG (decoded to the null address) and was replaced by
 * this API-based approach, which was then verified correct against
 * Solscan (exact LP token match, exact supply match).
 *
 * Everything else stays "Unknown" (null) rather than guessed:
 * - Non-Raydium pools (Meteora, Orca, pump.fun bonding curves, etc.)
 * - Raydium CLMM ("Concentrated") pools — these use per-position NFTs
 *   instead of one fungible LP token, so there's no single supply to check
 * - LP "locked" status (as opposed to burned) — that requires recognizing
 *   specific locker-program addresses, which isn't built
 *
 * A Birdeye Security-endpoint-based guess was tried earlier and dropped:
 * it returned null for every single token tested, meaning the guessed
 * field names didn't match Birdeye's actual (undocumented) response shape.
 */
async function getVerifiedLpBurnStatus(mintAddress: string): Promise<boolean | null> {
  const pairInfo = await getPrimaryPairInfo(mintAddress);
  if (!pairInfo || pairInfo.dexId !== "raydium") return null;

  const poolInfo = await getRaydiumPoolLpInfo(pairInfo.pairAddress);
  if (poolInfo.poolType !== "Standard" || !poolInfo.lpMint) return null;

  const burnStatus = await checkLpBurnStatus(poolInfo.lpMint);
  return burnStatus.lpBurned;
}

/**
 * Refreshes market + risk data for every token currently on a watchlist OR
 * currently showing in the public feed. Feed tokens are included here too
 * (not just watchlisted ones) so signal cards don't go stale between
 * discovery runs — a token can fall out of the current trending list and
 * stop getting refreshed by discoverTrendingTokens, but its card is still
 * visible in the feed until it ages out of the retention cap.
 *
 * Triggered on a schedule by the Vercel Cron route at app/api/cron/sync-tokens.
 */
export const syncWatchedTokens = inngest.createFunction(
  { id: "sync-watched-tokens", concurrency: 5 },
  { event: "solsight/tokens.sync.requested" },
  async ({ step }) => {
    const tokens = (await step.run("load-watched-tokens", () =>
      prisma.token.findMany({
        where: {
          OR: [{ watchlistItems: { some: {} } }, { signals: { some: {} } }],
        },
        select: { id: true, mintAddress: true },
      })
    )) as { id: string; mintAddress: string }[];

    for (const token of tokens) {
      await step.run(`refresh-${token.mintAddress}`, async () => {
        const [overview, mintSafety, lpBurned] = await Promise.all([
          getTokenOverview(token.mintAddress),
          getMintSafety(token.mintAddress),
          getVerifiedLpBurnStatus(token.mintAddress),
        ]);
        if (!overview) return;

        const rugScore = heuristicRugScore({
          liquidityUsd: overview.liquidityUsd,
          topHolderPct: mintSafety.topHolderPct,
          lpLocked: null, // "locked" (as opposed to burned) isn't verified — stays Unknown
          mintAuthorityRevoked: mintSafety.mintAuthorityRevoked,
        });

        await prisma.token.update({
          where: { id: token.id },
          data: {
            priceUsd: overview.priceUsd,
            marketCapUsd: overview.marketCapUsd,
            liquidityUsd: overview.liquidityUsd,
            volume24hUsd: overview.volume24hUsd,
            priceChange1h: overview.priceChange1h,
            priceChange24h: overview.priceChange24h,
            rugScore,
            mintAuthorityRevoked: mintSafety.mintAuthorityRevoked,
            freezeAuthorityRevoked: mintSafety.freezeAuthorityRevoked,
            topHolderPct: mintSafety.topHolderPct,
            lpLocked: null,
            lpBurned,
          },
        });
      });
    }

    return { synced: tokens.length };
  }
);

/**
 * Auto-discovers real trending tokens (via Birdeye, sorted by 24h volume —
 * see getTrendingTokens' doc comment for why not Birdeye's default
 * popularity sort) and seeds them into the Token table + signal feed.
 *
 * Runs on Inngest's own cron scheduler rather than Vercel Cron, since the
 * Vercel Hobby tier only allows daily cron jobs (see sync-tokens' cron
 * route) and trending discovery is only useful running much more often
 * than once a day. Inngest's `cron` trigger is independent of Vercel's
 * scheduler and isn't subject to that limit.
 *
 * A Signal row is only created for genuinely new tokens (first time we've
 * ever seen the mint address) — this keeps /feed growing with real
 * discoveries instead of spamming a repeat entry every run for the same
 * already-tracked tokens. The signal's numbers (quality score, risk level)
 * are all derived deterministically from real data; sourceModel is labeled
 * "rules-engine-discovery-v1" rather than an AI model name, since no LLM
 * reasoning is involved in generating it — only Claude's chart-analysis
 * feature on the token page itself does that.
 *
 * After discovery, old signals beyond FEED_SIGNAL_CAP are pruned so the
 * feed stays fresh — the oldest ones age out automatically as new ones
 * come in, rather than the feed growing forever.
 */
export const discoverTrendingTokens = inngest.createFunction(
  { id: "discover-trending-tokens", concurrency: 3 },
  { cron: "*/30 * * * *" }, // every 30 minutes
  async ({ step }) => {
    const trending = (await step.run("fetch-trending", () =>
      getTrendingTokens(20)
    )) as Awaited<ReturnType<typeof getTrendingTokens>>;

    let discovered = 0;
    let signalsCreated = 0;

    for (const t of trending) {
      const result = (await step.run(`upsert-${t.mintAddress}`, async () => {
        const existing = await prisma.token.findUnique({ where: { mintAddress: t.mintAddress } });

        // Enrich with real mint-safety and LP-burn reads so newly
        // discovered tokens aren't stuck showing "Unknown" on every field
        // until the next sync happens to cover them.
        const [overview, mintSafety, lpBurned] = await Promise.all([
          getTokenOverview(t.mintAddress),
          getMintSafety(t.mintAddress),
          getVerifiedLpBurnStatus(t.mintAddress),
        ]);

        // The explicit blue-chip denylist (see lib/market-data.ts) catches
        // known majors up front, but Birdeye's trending list can also
        // surface large-caps we haven't denylisted by mint address. Now
        // that we have a real market cap from the overview fetch, skip
        // anything too large to be a memecoin-signal candidate.
        if (overview && isAboveMemecoinMarketCapCeiling(overview.marketCapUsd, overview.liquidityUsd)) {
          return { token: null, isNew: false, rugScore: null, skippedAsBlueChip: true };
        }

        const rugScore = overview
          ? heuristicRugScore({
              liquidityUsd: overview.liquidityUsd,
              topHolderPct: mintSafety.topHolderPct,
              lpLocked: null,
              mintAuthorityRevoked: mintSafety.mintAuthorityRevoked,
            })
          : null;

        const tokenData = {
          symbol: overview?.symbol ?? t.symbol,
          name: overview?.name ?? t.name,
          imageUrl: overview?.imageUrl ?? t.imageUrl,
          priceUsd: overview?.priceUsd ?? t.priceUsd,
          marketCapUsd: overview?.marketCapUsd ?? null,
          liquidityUsd: overview?.liquidityUsd ?? t.liquidityUsd,
          volume24hUsd: overview?.volume24hUsd ?? t.volume24hUsd,
          priceChange1h: overview?.priceChange1h ?? null,
          priceChange24h: overview?.priceChange24h ?? null,
          rugScore,
          mintAuthorityRevoked: mintSafety.mintAuthorityRevoked,
          freezeAuthorityRevoked: mintSafety.freezeAuthorityRevoked,
          topHolderPct: mintSafety.topHolderPct,
          lpLocked: null,
          lpBurned,
        };

        const token = await prisma.token.upsert({
          where: { mintAddress: t.mintAddress },
          update: tokenData,
          create: { mintAddress: t.mintAddress, ...tokenData },
        });

        return { token, isNew: !existing, rugScore, skippedAsBlueChip: false };
      })) as { token: { id: string } | null; isNew: boolean; rugScore: number | null; skippedAsBlueChip: boolean };

      if (result.skippedAsBlueChip || !result.token) continue;
      const tokenId = result.token.id;
      if (result.isNew) discovered++;

      if (result.isNew) {
        await step.run(`signal-${t.mintAddress}`, async () => {
          const rugScore = result.rugScore ?? 50;
          const riskLevel =
            rugScore < 25 ? "LOW" : rugScore < 50 ? "MEDIUM" : rugScore < 75 ? "HIGH" : "EXTREME";

          await prisma.signal.create({
            data: {
              tokenId,
              type: "NEW_LISTING",
              headline: `${t.symbol} entered the top trending tokens by 24h volume`,
              reasoning:
                `Discovered via Birdeye's trending list (rank #${t.rank} by 24h volume). ` +
                `Liquidity: ${t.liquidityUsd ? `$${Math.round(t.liquidityUsd).toLocaleString()}` : "unknown"}, ` +
                `24h volume: ${t.volume24hUsd ? `$${Math.round(t.volume24hUsd).toLocaleString()}` : "unknown"}. ` +
                `Rug screener score: ${rugScore}/100 based on real on-chain liquidity and mint-authority data.`,
              qualityScore: Math.max(0, Math.min(100, 100 - rugScore)),
              confidence: t.liquidityUsd && t.liquidityUsd > 10000 ? 0.7 : 0.4,
              riskLevel,
              sourceModel: "rules-engine-discovery-v1",
            },
          });
          signalsCreated++;
        });
      }
    }

    const pruned = await step.run("prune-old-signals", async () => {
      const total = await prisma.signal.count();
      if (total <= FEED_SIGNAL_CAP) return 0;

      const overflow = await prisma.signal.findMany({
        orderBy: { createdAt: "asc" },
        take: total - FEED_SIGNAL_CAP,
        select: { id: true },
      });
      await prisma.signal.deleteMany({
        where: { id: { in: overflow.map((s: { id: string }) => s.id) } },
      });
      return overflow.length;
    });

    return { scanned: trending.length, discovered, signalsCreated, pruned };
  }
);

export const functions = [syncWatchedTokens, discoverTrendingTokens];