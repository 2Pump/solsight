import Link from "next/link";
import { RadarMark } from "@/components/shared/radar-mark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="container flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <RadarMark className="h-5 w-5" />
          <span className="font-display text-sm font-medium text-ink">SolSight</span>
          <span className="text-xs text-ink-faint">— open source, MIT licensed</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted">
          <Link href="/feed" className="hover:text-ink">Signal Feed</Link>
          <Link href="/dashboard" className="hover:text-ink">Dashboard</Link>
          <Link href="https://github.com/solsight/solsight" className="hover:text-ink">GitHub</Link>
          <Link href="https://github.com/solsight/solsight/blob/main/CONTRIBUTING.md" className="hover:text-ink">
            Contribute
          </Link>
        </div>
      </div>
      <p className="container mt-6 text-xs leading-relaxed text-ink-faint">
        SolSight is an open-source research tool. Nothing on this site is financial advice.
        Memecoins are extremely high risk — signals describe patterns in public on-chain and
        market data, they do not predict outcomes. Always do your own research.
      </p>
    </footer>
  );
}
