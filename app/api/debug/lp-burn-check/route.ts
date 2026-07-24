import { NextRequest, NextResponse } from "next/server";
import { getPrimaryPairInfo } from "@/lib/market-data";
import { getRaydiumLpBurnStatus } from "@/lib/helius";

/**
 * TEMPORARY debug route — GET /api/debug/lp-burn-check?address=<mint>
 *
 * Returns the raw decoded pool/lpMint/supply data so the Raydium account
 * decoding in lib/helius.ts's getRaydiumLpBurnStatus can be manually
 * cross-checked (e.g. against Solscan) before it's trusted anywhere near
 * the actual rug score. Delete this route once verified.
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
      note: `This token's primary pool is on ${pairInfo.dexId}, not Raydium — this decoder only supports Raydium AMM v4 pools right now.`,
    });
  }

  const result = await getRaydiumLpBurnStatus(pairInfo.pairAddress);

  return NextResponse.json({
    tokenAddress: address,
    pairAddress: pairInfo.pairAddress,
    dexId: pairInfo.dexId,
    ...result,
    verifyHint: result.lpMint
      ? `Cross-check: open https://solscan.io/token/${result.lpMint} — does it look like an LP token for this pool? Also check https://solscan.io/account/${pairInfo.pairAddress} and confirm its "LP Mint" field (if Solscan shows one) matches.`
      : null,
  });
}