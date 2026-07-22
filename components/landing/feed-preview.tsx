"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react";

const SAMPLE_SIGNALS = [
  {
    symbol: "$WIF",
    headline: "Reclaimed 1h VWAP with rising volume",
    quality: 92,
    risk: "LOW" as const,
    type: "Breakout",
    icon: TrendingUp,
  },
  {
    symbol: "$SLERF",
    headline: "LP unlocked 40 minutes ago, top wallet moving supply",
    quality: 88,
    risk: "EXTREME" as const,
    type: "Rug Warning",
    icon: ShieldAlert,
  },
  {
    symbol: "$MEW",
    headline: "Three wallets that called $WIF early are accumulating",
    quality: 81,
    risk: "MEDIUM" as const,
    type: "Whale Accumulation",
    icon: TrendingUp,
  },
  {
    symbol: "$POPCAT",
    headline: "Momentum fading, volume down 60% over 2h",
    quality: 64,
    risk: "MEDIUM" as const,
    type: "Momentum",
    icon: TrendingDown,
  },
];

const RISK_BADGE: Record<string, string> = {
  LOW: "badge-risk-low",
  MEDIUM: "badge-risk-medium",
  HIGH: "badge-risk-high",
  EXTREME: "badge-risk-extreme",
};

export function FeedPreview() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="container">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              The feed, live
            </h2>
            <p className="mt-3 max-w-md text-ink-muted">
              A snapshot of what traders are seeing right now. Every signal is
              scored, voted on, and fully explainable.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/feed">
              Open full feed <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3">
          {SAMPLE_SIGNALS.map((s, i) => (
            <motion.div
              key={s.symbol + i}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="glass glass-hover flex flex-wrap items-center gap-4 px-5 py-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-signal/25 bg-signal/10">
                <s.icon className="h-4 w-4 text-signal-soft" />
              </div>

              <div className="min-w-[220px] flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-ink">{s.symbol}</span>
                  <span className="text-xs text-ink-faint">{s.type}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{s.headline}</p>
              </div>

              <span className={RISK_BADGE[s.risk]}>{s.risk}</span>

              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-signal to-pulse"
                    style={{ width: `${s.quality}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-ink-muted">{s.quality}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
