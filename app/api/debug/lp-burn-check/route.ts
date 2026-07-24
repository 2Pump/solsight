import { NextRequest, NextResponse } from "next/server";
import { getPrimaryPairInfo, getRaydiumPoolLpInfo } from "@/lib/market-data";
import { checkLpBurnStatus } from "@/lib/helius";

/**
 * TEMPORARY debug route — GET /api/debug/lp-burn-check?address=<mint>
 *
 * Returns the real Raydium-reported lpMint plus its on-chain supply, so
 * this can be spot-checked against Solscan before being trusted anywhere
 * near the actual rug score. Delete this route once verified.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Pass ?address=<token mint address>" }, { status: 400 });
  }

  const pairInfo = await getPrimaryPairInfo(address);
  if (!pairInfo) {
    return NextResponse.json({ error: "No trading pair found for this token on Dexscreener" }, { status: 404 });
  }

  if (pairInfo.dexId !== "raydium") {
    return NextResponse.json({
      tokenAddress: address,
      pairAddress: pairInfo.pairAddress,
      dexId: pairInfo.dexId,
      note: `This token's primary pool is on ${pairInfo.dexId}, not Raydium — this check only supports Raydium pools right now.`,
    });
  }

  const poolInfo = await getRaydiumPoolLpInfo(pairInfo.pairAddress);

  if (poolInfo.poolType === "Concentrated") {
    return NextResponse.json({
      tokenAddress: address,
      pairAddress: pairInfo.pairAddress,
      dexId: pairInfo.dexId,
      poolType: poolInfo.poolType,
      note: "This is a Raydium CLMM (Concentrated Liquidity) pool — liquidity is represented as per-position NFTs, not one fungible LP token, so there's no single supply to check for zero. This detection method only supports Standard (constant-product) pools right now.",
    });
  }

  if (!poolInfo.lpMint) {
    return NextResponse.json({
      tokenAddress: address,
      pairAddress: pairInfo.pairAddress,
      dexId: pairInfo.dexId,
      poolType: poolInfo.poolType,
      note: "Raydium's API didn't return an lpMint for this pool — either the pool ID is stale/wrong, or the response shape differs from expected.",
    });
  }

  const burnStatus = await checkLpBurnStatus(poolInfo.lpMint);

  return NextResponse.json({
    tokenAddress: address,
    pairAddress: pairInfo.pairAddress,
    dexId: pairInfo.dexId,
    poolType: poolInfo.poolType,
    lpMint: poolInfo.lpMint,
    ...burnStatus,
    verifyHint: `Cross-check: open https://solscan.io/token/${poolInfo.lpMint} on Solscan — does it look like an LP token, and does its supply match ${burnStatus.lpSupply}?`,
  });
}