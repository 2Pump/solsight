import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding SolSight sample data…");

  const wif = await prisma.token.upsert({
    where: { mintAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
    update: {},
    create: {
      mintAddress: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
      symbol: "WIF",
      name: "dogwifhat",
      priceUsd: 1.84,
      marketCapUsd: 1_840_000_000,
      liquidityUsd: 4_200_000,
      volume24hUsd: 312_000_000,
      priceChange1h: 1.2,
      priceChange24h: 12.4,
      rugScore: 8,
      lpLocked: true,
      lpBurned: true,
      mintAuthorityRevoked: true,
      freezeAuthorityRevoked: true,
      topHolderPct: 18.2,
      holderCount: 128_400,
    },
  });

  const slerf = await prisma.token.upsert({
    where: { mintAddress: "4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs" },
    update: {},
    create: {
      mintAddress: "4LLbsb5ReP3yEtYzmXewyGjcir5uXtKFURtaEUVC2AHs",
      symbol: "SLERF",
      name: "Slerf",
      priceUsd: 0.21,
      marketCapUsd: 88_000_000,
      liquidityUsd: 210_000,
      volume24hUsd: 4_100_000,
      priceChange1h: -6.2,
      priceChange24h: -18.9,
      rugScore: 71,
      lpLocked: false,
      lpBurned: false,
      mintAuthorityRevoked: false,
      freezeAuthorityRevoked: true,
      topHolderPct: 44.6,
      holderCount: 9_200,
    },
  });

  await prisma.signal.createMany({
    data: [
      {
        tokenId: wif.id,
        type: "BREAKOUT",
        headline: "Reclaimed the 1h VWAP with rising volume",
        reasoning:
          "Price broke back above the 1h volume-weighted average price on the third retest, with volume 2.3x the 6h mean.",
        qualityScore: 92,
        confidence: 0.81,
        riskLevel: "LOW",
        sourceModel: "claude-sonnet-4-6",
      },
      {
        tokenId: slerf.id,
        type: "RUG_WARNING",
        headline: "LP unlocked, top wallet moving supply",
        reasoning:
          "Liquidity lock expired and the top holder has moved 60% of their balance to a fresh wallet in the last 20 minutes.",
        qualityScore: 88,
        confidence: 0.9,
        riskLevel: "EXTREME",
        sourceModel: "rules-engine-v2",
      },
    ],
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
