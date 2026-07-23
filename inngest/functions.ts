import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { getTokenOverview, getTrendingTokens, heuristicRugScore, isAboveMemecoinMarketCapCeiling } from "@/lib/market-data";
import { getMintSafety } from "@/lib/helius";

/**
 * Refreshes market + risk data for every token currently on a watchlist.
 * Triggered on a schedule by the Vercel Cron route at app/api/cron/sync-tokens.
 */
export const syncWatchedTokens = inngest.createFunction(
  { id: "sync-watched-tokens", concurrency: 5 },
  { event: "solsight/tokens.sync.requested" },
  async ({ step }) => {
    const tokens = (await step.run("load-watched-tokens", () =>
      prisma.token.findMany({
        where: { watchlistItems: { some: {} } },
        select: { id: true, mintAddress: true },
      })
    )) as { id: string; mintAddress: string }[];

    for (const token of tokens) {
      await step.run(`refresh-${token.mintAddress}`, async () => {
        const [overview, mintSafety] = await Promise.all([
          getTokenOverview(token.mintAddress),
          getMintSafety(token.mintAddress),
        ]);
        if (!overview) return;

        const rugScore = heuristicRugScore({
          liquidityUsd: overview.liquidityUsd,
          topHolderPct: mintSafety.topHolderPct,
          lpLocked: null,
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

        // Enrich with a real mint-safety read so newly-discovered tokens
        // aren't stuck showing "Unknown" on every field until the next
        // watchlist sync happens to cover them.
        const [overview, mintSafety] = await Promise.all([
          getTokenOverview(t.mintAddress),
          getMintSafety(t.mintAddress),
        ]);

        // The explicit blue-chip denylist (see lib/market-data.ts) catches
        // known majors up front, but Birdeye's trending list can also
        // surface large-caps we haven't denylisted by mint address. Now
        // that we have a real market cap from the overview fetch, skip
        // anything too large to be a memecoin-signal candidate — running
        // it through the memecoin-tuned rug heuristic produces nonsense
        // (a large, liquid, well-established token can score EXTREME risk
        // purely because "LP lock status unknown" is scored as a red flag,
        // which it isn't at that scale). Liquidity is passed alongside
        // market cap as a fallback signal for when market cap comes back
        // null — see isAboveMemecoinMarketCapCeiling's doc comment.
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

    return { scanned: trending.length, discovered, signalsCreated };
  }
);

export const functions = [syncWatchedTokens, discoverTrendingTokens];