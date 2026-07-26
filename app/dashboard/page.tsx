import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Features } from "@/components/landing/features";
import { RadarMark } from "@/components/shared/radar-mark";
import {
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Lock,
  HelpCircle,
} from "lucide-react";

export const metadata = { title: "How SolSight works" };

/**
 * Public info hub — explains what SolSight actually does and how, honestly,
 * including what isn't built yet. No account required to read this; the
 * real product (signal feed, AI chart reads, wallet bubble maps, watchlist)
 * lives behind the "Launch App" CTA at the bottom, which requires signing in.
 */
export default function DashboardInfoPage() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />

      <div className="container relative py-16">
        <div className="mx-auto max-w-2xl text-center">
          <RadarMark className="mx-auto h-10 w-10" />
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            What SolSight actually does
          </h1>
          <p className="mt-4 text-ink-muted">
            One radar for Solana memecoin signals — real on-chain data, real AI chart reads, real
            fund-flow mapping. Here's exactly how each piece works, including where the data comes
            from and what we haven't built yet.
          </p>
        </div>

        <div className="mt-16">
          <Features />
        </div>

        {/* Transparency section — how discovery actually runs, and what's
            still genuinely unknown. Real detail rather than vague marketing
            copy, matching how the product itself is built: honest about
            gaps instead of papering over them. */}
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2">
          <div className="glass p-6">
            <div className="mb-3 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-signal-soft" />
              <h3 className="font-display text-sm font-semibold text-ink">
                How discovery actually runs
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              Every 30 minutes, a background job pulls Solana's real trending-token list (sorted by
              24h volume, not popularity), filters out large-cap/blue-chip tokens so the feed stays
              focused on genuine memecoin-range upside, and screens each new find for real on-chain
              risk before it ever reaches the feed. The feed keeps the most recent signals and
              retires older ones automatically — nothing sits stale forever.
            </p>
          </div>

          <div className="glass p-6">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-pulse" />
              <h3 className="font-display text-sm font-semibold text-ink">
                What the rug screener actually checks
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              Mint authority, freeze authority, and holder concentration are read directly from the
              chain for every token. LP burn status is independently verified for Raydium and
              PumpSwap pools — confirmed against real on-chain data, not guessed. Every check that
              can't be reliably determined shows "Unknown" instead of a fabricated answer.
            </p>
          </div>

          <div className="glass p-6">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber" />
              <h3 className="font-display text-sm font-semibold text-ink">
                What "LP locked" means here (and what it doesn't yet)
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              We can verify whether a pool's liquidity has been permanently burned. Locking — where
              liquidity is held by a time-based contract instead — uses several different competing
              services with no single way to check across all of them, so that specific status
              currently shows as "Unknown" rather than a guess.
            </p>
          </div>

          <div className="glass p-6">
            <div className="mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-ink-faint" />
              <h3 className="font-display text-sm font-semibold text-ink">
                What the wallet map doesn't do
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">
              The bubble map shows real transfer relationships between wallets — every connection is
              an actual on-chain transaction. It does not flag "insider clusters" or wash trading;
              that kind of pattern detection is a harder, separate problem we haven't built. Every
              wallet shown is unflagged until real detection logic exists.
            </p>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-lg text-center">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Ready to look at what actually matters?
          </h2>
          <p className="mt-3 text-sm text-ink-muted">
            The live signal feed, AI chart reads, wallet bubble maps, and your watchlist are all
            free once you're signed in — a Solana wallet or Discord account is all it takes.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href="/feed">
              Launch App <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
