import { NextRequest, NextResponse } from "next/server";
import { getPrimaryPairInfo, getRaydiumPoolLpInfo } from "@/lib/market-data";
import { checkLpBurnStatus, getPumpSwapLpMint } from "@/lib/helius";

/**
 * TEMPORARY debug route — GET /api/debug/lp-burn-check?address=<mint>
 *
 * Covers Raydium (verified, live in production) and PumpSwap (new,
 * unverified — this route exists specifically to check it before it's
 * wired into anything real). Delete once PumpSwap is verified or dropped.
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

  if (pairInfo.dexId === "pumpfun") {
    return NextResponse.json({
      tokenAddress: address,
      pairAddress: pairInfo.pairAddress,
      dexId: pairInfo.dexId,
      note: "Still on pump.fun's bonding curve — hasn't graduated to a real AMM pool yet, so there's no LP token to check at all. Not a failure, just a different lifecycle stage.",
    });
  }

  if (pairInfo.dexId === "pumpswap") {
    const lpInfo = await getPumpSwapLpMint(pairInfo.pairAddress);
    if (!lpInfo.verified) {
      return NextResponse.json({
        tokenAddress: address,
        pairAddress: pairInfo.pairAddress,
        dexId: pairInfo.dexId,
        derivedLpMint: lpInfo.lpMint,
        verified: false,
        note: lpInfo.note,
      });
    }
    const burnStatus = await checkLpBurnStatus(lpInfo.lpMint!);
    return NextResponse.json({
      tokenAddress: address,
      pairAddress: pairInfo.pairAddress,
      dexId: pairInfo.dexId,
      lpMint: lpInfo.lpMint,
      verified: true,
      ...burnStatus,
      verifyHint: `Cross-check: open https://solscan.io/token/${lpInfo.lpMint} on Solscan — does it look like a PumpSwap LP token, and does its supply match ${burnStatus.lpSupply}?`,
    });
  }

  if (pairInfo.dexId === "raydium") {
    const poolInfo = await getRaydiumPoolLpInfo(pairInfo.pairAddress);
    if (poolInfo.poolType === "Concentrated") {
      return NextResponse.json({
        tokenAddress: address,
        pairAddress: pairInfo.pairAddress,
        dexId: pairInfo.dexId,
        poolType: poolInfo.poolType,
        note: "Raydium CLMM pool — uses per-position NFTs, not one fungible LP token, so there's no single supply to check.",
      });
    }
    if (!poolInfo.lpMint) {
      return NextResponse.json({
        tokenAddress: address,
        pairAddress: pairInfo.pairAddress,
        dexId: pairInfo.dexId,
        note: "Raydium's API didn't return an lpMint for this pool.",
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
      verifyHint: `Cross-check: open https://solscan.io/token/${poolInfo.lpMint} on Solscan.`,
    });
  }

  return NextResponse.json({
    tokenAddress: address,
    pairAddress: pairInfo.pairAddress,
    dexId: pairInfo.dexId,
    note: `${pairInfo.dexId} isn't supported by this check yet (Meteora is next up).`,
  });
}