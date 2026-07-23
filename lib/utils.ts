import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, resolving conflicts in favor of the last one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a USD amount with sensible precision for memecoin price ranges. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.0001) return `$${value.toExponential(2)}`;
  if (value < 1) return `$${value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Compact large numbers: 1_200_000 -> "1.2M" */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Shorten a Solana address for display: 7xKX...9pQm */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/** Map a 0-100 rug score to a risk bucket used for badges + colors. */
export function riskLevelFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" | "EXTREME" {
  if (score < 25) return "LOW";
  if (score < 50) return "MEDIUM";
  if (score < 75) return "HIGH";
  return "EXTREME";
}

/**
 * Strip any leading "$" from a token symbol before display. Some providers
 * (and some on-chain token metadata) already include the $ in the symbol
 * string itself — rendering `$${symbol}` on top of that produced the
 * "$$WIF" display bug. Every place a symbol is shown should route through
 * this so the $ is added exactly once, regardless of what the source data
 * looks like.
 */
export function formatSymbol(symbol: string): string {
  return `$${symbol.replace(/^\$+/, "")}`;
}