"use client";

import { motion } from "framer-motion";
import { ShieldCheck, BrainCircuit, Network, LineChart, Bell, Users } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    tone: "pulse",
    title: "Rug screener",
    body: "LP lock status, mint & freeze authority, holder concentration, and a composite risk score computed the moment a token appears.",
  },
  {
    icon: BrainCircuit,
    tone: "signal",
    title: "AI chart reading",
    body: "Claude reads OHLCV structure and on-chain context to explain what a chart is actually doing — in plain language, with calibrated confidence.",
  },
  {
    icon: Network,
    tone: "signal",
    title: "Wallet bubble maps",
    body: "Visualize fund flow between wallets as a living network graph. Spot insider clusters and coordinated buys before they're obvious.",
  },
  {
    icon: LineChart,
    tone: "pulse",
    title: "Auto-annotated charts",
    body: "Support, resistance, breakout zones, and distribution signatures are marked automatically — no more squinting at candles.",
  },
  {
    icon: Bell,
    tone: "amber",
    title: "Watchlist alerts",
    body: "Follow a token or wallet and get notified the moment its signal quality — or its risk — crosses a threshold you set.",
  },
  {
    icon: Users,
    tone: "signal",
    title: "Community voting",
    body: "Every public signal is upvoted or downvoted by real traders, surfacing the calls that hold up and burying the noise.",
  },
];

const TONE_CLASS: Record<string, string> = {
  pulse: "bg-pulse/10 text-pulse border-pulse/25",
  signal: "bg-signal/10 text-signal-soft border-signal/25",
  amber: "bg-amber/10 text-amber border-amber/25",
};

export function Features() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            One radar, four layers of signal
          </h2>
          <p className="mt-4 text-ink-muted">
            Each layer exists to remove one specific kind of noise — safety
            risk, chart ambiguity, hidden wallet coordination, and low-quality
            calls.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="glass glass-hover group p-6"
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border ${TONE_CLASS[f.tone]}`}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
