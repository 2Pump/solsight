import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

/**
 * Vercel Cron target (see vercel.json). Verifies the CRON_SECRET header
 * Vercel attaches to scheduled invocations, then fans the real work out
 * to Inngest so it can run with retries and concurrency control.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await inngest.send({ name: "solsight/tokens.sync.requested" });
  return NextResponse.json({ triggered: true });
}
