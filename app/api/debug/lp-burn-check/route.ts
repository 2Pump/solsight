import { NextRequest, NextResponse } from "next/server";
import { getPrimaryPairInfo, getRaydiumLpMint } from "@/lib/market-data";
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

  // Fetch Raydium's raw response directly here (rather than going through
  // getRaydiumLpMint) so we can see exactly what they returned — whether
  // it's a clean "pool not found," an unexpected shape, or something else.
  let raydiumRaw: unknown = null;
  try {
    const raydiumRes = await fetch(
      `https://api-v3.raydium.io/pools/info/ids?ids=${pairInfo.pairAddress}`
    );
    raydiumRaw = await raydiumRes.json();
  } catch (err) {
    raydiumRaw = { fetchError: String(err) };
  }

  const lpMint = await getRaydiumLpMint(pairInfo.pairAddress);
  if (!lpMint) {
    return NextResponse.json({
      tokenAddress: address,
      pairAddress: pairInfo.pairAddress,
      dexId: pairInfo.dexId,
      note: "Raydium's API didn't return an lpMint for this pool — either the pool ID is stale/wrong, or the response shape differs from expected.",
      raydiumRawResponse: raydiumRaw,
    });
  }

  const burnStatus = await checkLpBurnStatus(lpMint);

  return NextResponse.json({
    tokenAddress: address,
    pairAddress: pairInfo.pairAddress,
    dexId: pairInfo.dexId,
    lpMint,
    ...burnStatus,
    verifyHint: `Cross-check: open https://solscan.io/token/${lpMint} on Solscan — does it look like an LP token, and does its supply match ${burnStatus.lpSupply}?`,
  });
}