import type { AlertType } from "@prisma/client";

/**
 * Single source of truth for what each alert type means, what it targets
 * (a watchlist token vs. a tracked wallet), and whether it needs a USD
 * threshold. Both the API route (validation) and the alerts page (form +
 * display) read from this so the two can't drift out of sync.
 */
export const ALERT_TYPE_META: Record<
  AlertType,
  {
    label: string;
    description: string;
    target: "token" | "trackedWallet";
    needsThreshold: boolean;
    thresholdLabel?: string;
  }
> = {
  PRICE_ABOVE: {
    label: "Price above",
    description: "Notify when a watchlist token's price rises above a level",
    target: "token",
    needsThreshold: true,
    thresholdLabel: "Price (USD)",
  },
  PRICE_BELOW: {
    label: "Price below",
    description: "Notify when a watchlist token's price falls below a level",
    target: "token",
    needsThreshold: true,
    thresholdLabel: "Price (USD)",
  },
  LARGE_TRANSACTION: {
    label: "Large transaction",
    description: "Notify when a tracked wallet moves more than a given USD amount in one transaction",
    target: "trackedWallet",
    needsThreshold: true,
    thresholdLabel: "Minimum transaction size (USD)",
  },
  WALLET_ACTIVITY: {
    label: "Any wallet activity",
    description: "Notify on any buy, sell, or transfer from a tracked wallet",
    target: "trackedWallet",
    needsThreshold: false,
  },
};

export const ALERT_TYPES = Object.keys(ALERT_TYPE_META) as AlertType[];
