"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignalRadar } from "@/components/landing/signal-radar";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-20 sm:pb-24 sm:pt-28">
      {/* Ambient background: soft grid + aurora glow, masked to fade toward the edges */}
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 bg-radar-gradient blur-2xl" />

      <div className="container relative grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-signal/25 bg-signal/10 px-3.5 py-1.5 text-xs font-medium text-signal-soft">
            <Sparkles className="h-3.5 w-3.5" />
            AI-read charts · on-chain screening · wallet tracking
          </div>

          <h1 className="font-display text-[2.75rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            See the signal
            <br />
            before the <span className="text-gradient">crowd does.</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
            SolSight scans every new Solana memecoin, screens it for rug risk,
            reads its chart with AI, and maps the wallets moving behind it —
            so you only look at what actually matters.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/dashboard">
                Launch App <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/feed">Browse live signals</Link>
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-6 border-t border-border pt-6 text-sm text-ink-faint">
            <Stat value="24k+" label="tokens screened" />
            <Stat value="98.2%" label="rug detection recall*" />
            <Stat value="< 2s" label="signal latency" />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            *Backtested on historical rugs; screening is probabilistic, not a guarantee.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="relative mx-auto w-full max-w-md"
        >
          <SignalRadar />
        </motion.div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold text-ink">{value}</div>
      <div>{label}</div>
    </div>
  );
}
