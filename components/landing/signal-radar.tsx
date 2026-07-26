"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Static polar layout so server and client render identically (no Math.random at render time).
// radius: 0-1 (fraction of container), angleDeg: 0 = top, clockwise.
const BLIPS = [
  { symbol: "$WIF", radius: 0.32, angleDeg: 40, tone: "pulse", score: 92, delay: 0 },
  { symbol: "$POPCAT", radius: 0.58, angleDeg: 120, tone: "signal", score: 78, delay: 0.4 },
  { symbol: "$MEW", radius: 0.44, angleDeg: 210, tone: "pulse", score: 85, delay: 0.8 },
  { symbol: "$SLERF", radius: 0.78, angleDeg: 280, tone: "risk", score: 21, delay: 1.2 },
  { symbol: "$BONK", radius: 0.68, angleDeg: 340, tone: "signal", score: 71, delay: 1.6 },
  { symbol: "$MYRO", radius: 0.22, angleDeg: 300, tone: "pulse", score: 88, delay: 2.0 },
] as const;

const TONE_COLOR: Record<string, string> = {
  signal: "#7C5CFF",
  pulse: "#00E5C7",
  risk: "#FF5C7A",
};

function polarToXY(radius: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  const x = 50 + radius * 50 * Math.cos(rad);
  const y = 50 + radius * 50 * Math.sin(rad);
  return { x, y };
}

export function SignalRadar() {
  return (
    <div className="glass glow-violet relative aspect-square w-full overflow-hidden rounded-3xl p-8">
      {/* concentric range rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        {[0.9, 0.68, 0.46, 0.24].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-signal/15"
            style={{ width: `${size * 100}%`, height: `${size * 100}%` }}
          />
        ))}
      </div>

      {/* rotating sweep beam */}
      <div className="absolute inset-8 overflow-hidden rounded-full">
        <div
          className="h-full w-full animate-radar-sweep"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(124,92,255,0.35), rgba(124,92,255,0) 22%, transparent 100%)",
          }}
        />
      </div>

      {/* center origin */}
      <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_20px_4px_rgba(124,92,255,0.6)]" />

      {/* blips */}
      {BLIPS.map((blip) => {
        const { x, y } = polarToXY(blip.radius, blip.angleDeg);
        const color = TONE_COLOR[blip.tone];
        return (
          <motion.div
            key={blip.symbol}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: blip.delay, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative flex items-center justify-center">
              <span
                className="absolute inline-flex h-3 w-3 animate-pulse-ring rounded-full"
                style={{ backgroundColor: color, animationDelay: `${blip.delay}s` }}
              />
              <span
                className="relative h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 12px 2px ${color}88` }}
              />
              <div
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border bg-void/80 px-2 py-0.5 font-mono text-[10px] backdrop-blur-sm",
                  blip.tone === "risk"
                    ? "border-risk/30 text-risk"
                    : blip.tone === "pulse"
                      ? "border-pulse/30 text-pulse"
                      : "border-signal/30 text-signal-soft"
                )}
              >
                {blip.symbol} · {blip.score}
              </div>
            </div>
          </motion.div>
        );
      })}

      {/* corner readout */}
      <div className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        radar · live
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 font-mono text-[10px] text-pulse">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-pulse" />
        scanning
      </div>
    </div>
  );
}
