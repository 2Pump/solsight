"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowBigUp,
  ArrowBigDown,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Waves,
  Lock,
  Flame,
  HelpCircle,
} from "lucide-react";
import { cn, formatUsd, formatPct, formatCompact } from "@/lib/utils";
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
  /** The signed-in user's existing vote on this signal (0 if none/signed out). */
  userVote?: 1 | -1 | 0;
  priceUsd?: number | null;
  priceChange24h?: number | null;
  liquidityUsd?: number | null;
  lpLocked?: boolean | null;
  lpBurned?: boolean | null;
  /** When the token's underlying market data was last refreshed — distinct from when the signal itself was created. */
  tokenUpdatedAt?: string;
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

function LpBadge({ label, status }: { label: string; status: boolean | null | undefined }) {
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-pulse">
        <Lock className="h-3 w-3" /> {label}
      </span>
    );
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-risk">
        <Flame className="h-3 w-3" /> {label} at risk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
      <HelpCircle className="h-3 w-3" /> {label} unknown
    </span>
  );
}

export function SignalCard({ signal }: { signal: SignalCardData }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [votes, setVotes] = useState(signal.votes);
  const [userVote, setUserVote] = useState<0 | 1 | -1>(signal.userVote ?? 0);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const Icon = TYPE_ICON[signal.type] ?? TrendingUp;

  async function vote(e: React.MouseEvent, value: 1 | -1) {
    e.stopPropagation(); // don't trigger the card's navigate-to-token click
    if (!session?.user) {
      router.push("/auth");
      return;
    }
    if (pending) return;

    const nextValue = userVote === value ? 0 : value; // clicking the active vote clears it
    const previousVotes = votes;
    const previousUserVote = userVote;

    // Optimistic update, rolled back on failure.
    setVotes((v) => v - userVote + nextValue);
    setUserVote(nextValue);
    setVoteError(null);
    setPending(true);

    try {
      const res = await fetch(`/api/signals/${signal.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: nextValue }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setVotes(previousVotes);
        setUserVote(previousUserVote);
        setVoteError(
          res.status === 409
            ? "You've already voted on this token elsewhere in the feed."
            : (body?.error as string) ?? "Couldn't save your vote — try again."
        );
        return;
      }

      const data = await res.json();
      if (typeof data.totalVotes === "number") setVotes(data.totalVotes);
    } catch {
      setVotes(previousVotes);
      setUserVote(previousUserVote);
      setVoteError("Couldn't save your vote — try again.");
    } finally {
      setPending(false);
    }
  }

  const priceStale =
    signal.tokenUpdatedAt &&
    Date.now() - new Date(signal.tokenUpdatedAt).getTime() > 1000 * 60 * 60; // > 1h old

  return (
    <div
      onClick={() => router.push(`/token/${signal.tokenMint}`)}
      className="glass glass-hover flex cursor-pointer gap-4 p-5"
    >
      <div className="flex flex-col items-center gap-1 pt-1">
        <button
          onClick={(e) => vote(e, 1)}
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
          onClick={(e) => vote(e, -1)}
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
          <span className="font-mono text-sm font-medium text-ink">{signal.tokenSymbol}</span>
          <span className="text-xs text-ink-faint">
            {signal.type.replace(/_/g, " ").toLowerCase()}
          </span>
          <span className={RISK_BADGE[signal.riskLevel]}>{signal.riskLevel}</span>
          <span className="ml-auto text-xs text-ink-faint">
            {formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Live-ish market snapshot — sourced from the Token row, refreshed
            on every discovery cycle (~30min) plus daily full sync. Not
            fetched fresh per pageview to avoid hammering Birdeye on every
            feed load; flagged as stale past 1h so it's never silently
            misleading. */}
        {(signal.priceUsd !== null && signal.priceUsd !== undefined) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-muted">
            <span>{formatUsd(signal.priceUsd)}</span>
            {signal.priceChange24h !== null && signal.priceChange24h !== undefined && (
              <span className={signal.priceChange24h >= 0 ? "text-pulse" : "text-risk"}>
                {formatPct(signal.priceChange24h)} 24h
              </span>
            )}
            {signal.liquidityUsd !== null && signal.liquidityUsd !== undefined && (
              <span>Liq {formatCompact(signal.liquidityUsd)}</span>
            )}
            {priceStale && <span className="text-ink-faint">(price may be stale)</span>}
          </div>
        )}

        <p className="mt-2 text-sm font-medium text-ink">{signal.headline}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{signal.reasoning}</p>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
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
          <LpBadge label="LP locked" status={signal.lpLocked} />
          <LpBadge label="LP burned" status={signal.lpBurned} />
        </div>

        {voteError && <p className="mt-2 text-xs text-risk">{voteError}</p>}
      </div>
    </div>
  );
}
