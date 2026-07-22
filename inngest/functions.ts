import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { getTokenOverview, heuristicRugScore } from "@/lib/market-data";

/**
 * Refreshes market + risk data for every token currently on a watchlist.
 * Triggered on a schedule by the Vercel Cron route at app/api/cron/sync-tokens.
 */
export const syncWatchedTokens = inngest.createFunction(
  { id: "sync-watched-tokens", concurrency: 5 },
  { event: "solsight/tokens.sync.requested" },
  async ({ step }) => {
    const tokens = await step.run("load-watched-tokens", () =>
      prisma.token.findMany({
        where: { watchlistItems: { some: {} } },
        select: { id: true, mintAddress: true },
      })
    );

    for (const token of tokens) {
      await step.run(`refresh-${token.mintAddress}`, async () => {
        const overview = await getTokenOverview(token.mintAddress);
        if (!overview) return;

        const rugScore = heuristicRugScore({
          liquidityUsd: overview.liquidityUsd,
          topHolderPct: null,
          lpLocked: null,
          mintAuthorityRevoked: null,
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
          },
        });
      });
    }

    return { synced: tokens.length };
  }
);

export const functions = [syncWatchedTokens];
