"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowBigUp, ArrowBigDown, TrendingUp, TrendingDown, ShieldAlert, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export interface SignalCardData {
  id: string;
  tokenSymbol: string;
  tokenMint: string;
  type: string;
  headline: string;
  reasoning: string;
  qualityScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  createdAt: string;
  votes: number;
}

const RISK_BADGE: Record<string, string> = {
  LOW: "badge-risk-low",
  MEDIUM: "badge-risk-medium",
  HIGH: "badge-risk-high",
  EXTREME: "badge-risk-extreme",
};

const TYPE_ICON: Record<string, typeof TrendingUp> = {
  BREAKOUT: TrendingUp,
  MOMENTUM: TrendingUp,
  WHALE_ACCUMULATION: Waves,
  WHALE_DISTRIBUTION: TrendingDown,
  RUG_WARNING: ShieldAlert,
};

export function SignalCard({ signal }: { signal: SignalCardData }) {
  const [votes, setVotes] = useState(signal.votes);
  const [userVote, setUserVote] = useState<0 | 1 | -1>(0);
  const Icon = TYPE_ICON[signal.type] ?? TrendingUp;

  function vote(value: 1 | -1) {
    // Optimistic local update; POST /api/signals/[id]/vote persists it.
    setVotes((v) => v - userVote + value);
    setUserVote(userVote === value ? 0 : value);
  }

  return (
    <div className="glass glass-hover flex gap-4 p-5">
      <div className="flex flex-col items-center gap-1 pt-1">
        <button
          onClick={() => vote(1)}
          className={cn(
            "rounded-lg p-1 transition-colors hover:bg-pulse/10",
            userVote === 1 ? "text-pulse" : "text-ink-faint"
          )}
          aria-label="Upvote signal"
        >
          <ArrowBigUp className="h-5 w-5" fill={userVote === 1 ? "currentColor" : "none"} />
        </button>
        <span className="font-mono text-sm text-ink-muted">{votes}</span>
        <button
          onClick={() => vote(-1)}
          className={cn(
            "rounded-lg p-1 transition-colors hover:bg-risk/10",
            userVote === -1 ? "text-risk" : "text-ink-faint"
          )}
          aria-label="Downvote signal"
        >
          <ArrowBigDown className="h-5 w-5" fill={userVote === -1 ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-signal/25 bg-signal/10">
            <Icon className="h-3.5 w-3.5 text-signal-soft" />
          </div>
          <Link href={`/token/${signal.tokenMint}`} className="font-mono text-sm font-medium text-ink hover:text-signal-soft">
            {signal.tokenSymbol}
          </Link>
          <span className="text-xs text-ink-faint">
            {signal.type.replace(/_/g, " ").toLowerCase()}
          </span>
          <span className={RISK_BADGE[signal.riskLevel]}>{signal.riskLevel}</span>
          <span className="ml-auto text-xs text-ink-faint">
            {formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}
          </span>
        </div>

        <p className="mt-2 text-sm font-medium text-ink">{signal.headline}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{signal.reasoning}</p>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-signal to-pulse"
              style={{ width: `${signal.qualityScore}%` }}
            />
          </div>
          <span className="font-mono text-xs text-ink-muted">
            Quality {signal.qualityScore}
          </span>
        </div>
      </div>
    </div>
  );
}
