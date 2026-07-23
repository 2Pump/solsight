import { NextRequest, NextResponse } from "next/server";
import { searchTokens } from "@/lib/market-data";

/** GET /api/tokens/search?q=BONK — resolves a symbol/name to real Solana tokens. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchTokens(q);
  return NextResponse.json({ results });
}