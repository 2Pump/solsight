"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Loader2, Bell } from "lucide-react";
import { cn, formatUsd, formatSymbol, shortenAddress } from "@/lib/utils";
import { ALERT_TYPE_META, ALERT_TYPES } from "@/lib/alerts";
import type { AlertType } from "@prisma/client";

export interface WatchlistTokenOption {
  mintAddress: string;
  symbol: string;
  name: string;
}

export interface TrackedWalletOption {
  id: string;
  address: string;
  label: string | null;
}

export interface AlertData {
  id: string;
  type: AlertType;
  thresholdUsd: number | null;
  token: { mintAddress: string; symbol: string; name: string } | null;
  trackedWallet: { address: string; label: string | null } | null;
}

const selectClass =
  "flex h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-ink transition-colors focus-visible:border-signal/50 focus-visible:outline-none";

function describeAlert(alert: AlertData): string {
  if (alert.type === "PRICE_ABOVE" || alert.type === "PRICE_BELOW") {
    const symbol = alert.token ? formatSymbol(alert.token.symbol) : "this token";
    const direction = alert.type === "PRICE_ABOVE" ? "rises above" : "falls below";
    return `${symbol} ${direction} ${formatUsd(alert.thresholdUsd)}`;
  }
  const walletLabel = alert.trackedWallet?.label || shortenAddress(alert.trackedWallet?.address ?? "", 6);
  if (alert.type === "LARGE_TRANSACTION") {
    return `${walletLabel} moves more than ${formatUsd(alert.thresholdUsd)} in one transaction`;
  }
  return `${walletLabel} has any wallet activity`;
}

export function AlertsManager({
  initialAlerts,
  watchlistTokens,
  trackedWallets,
}: {
  initialAlerts: AlertData[];
  watchlistTokens: WatchlistTokenOption[];
  trackedWallets: TrackedWalletOption[];
}) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [type, setType] = useState<AlertType>("PRICE_ABOVE");
  const [mintAddress, setMintAddress] = useState(watchlistTokens[0]?.mintAddress ?? "");
  const [trackedWalletId, setTrackedWalletId] = useState(trackedWallets[0]?.id ?? "");
  const [threshold, setThreshold] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const meta = ALERT_TYPE_META[type];
  const hasTokens = watchlistTokens.length > 0;
  const hasWallets = trackedWallets.length > 0;
  const targetAvailable = meta.target === "token" ? hasTokens : hasWallets;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (meta.needsThreshold) {
      const num = Number(threshold);
      if (!threshold || Number.isNaN(num) || num <= 0) {
        setError("Enter a valid positive number for the threshold.");
        return;
      }
    }

    const body =
      meta.target === "token"
        ? { type, mintAddress, thresholdUsd: Number(threshold) }
        : type === "WALLET_ACTIVITY"
          ? { type, trackedWalletId }
          : { type, trackedWalletId, thresholdUsd: Number(threshold) };

    setCreating(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Couldn't create that alert.");
        return;
      }
      setAlerts((prev) => [data.alert, ...prev]);
      setThreshold("");
    } catch {
      setError("Couldn't create that alert — try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="glass mb-6 p-5">
        <label className="mb-2 block text-sm font-medium text-ink">Create an alert</label>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as AlertType);
              setError(null);
            }}
            className={selectClass}
          >
            {ALERT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ALERT_TYPE_META[t].label}
              </option>
            ))}
          </select>

          {meta.target === "token" ? (
            <select
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              className={selectClass}
              disabled={!hasTokens}
            >
              {hasTokens ? (
                watchlistTokens.map((t) => (
                  <option key={t.mintAddress} value={t.mintAddress}>
                    {formatSymbol(t.symbol)} — {t.name}
                  </option>
                ))
              ) : (
                <option value="">No watchlist tokens yet</option>
              )}
            </select>
          ) : (
            <select
              value={trackedWalletId}
              onChange={(e) => setTrackedWalletId(e.target.value)}
              className={selectClass}
              disabled={!hasWallets}
            >
              {hasWallets ? (
                trackedWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label || shortenAddress(w.address, 6)}
                  </option>
                ))
              ) : (
                <option value="">No tracked wallets yet</option>
              )}
            </select>
          )}

          {meta.needsThreshold ? (
            <Input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={meta.thresholdLabel}
              inputMode="decimal"
              className="font-mono"
            />
          ) : (
            <div className="hidden sm:block" />
          )}

          <Button type="submit" disabled={creating || !targetAvailable} className="shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>

        <p className="mt-2 text-xs text-ink-faint">{meta.description}</p>
        {!targetAvailable && (
          <p className="mt-1 text-xs text-amber">
            {meta.target === "token"
              ? "Add a token to your watchlist first to create a price alert."
              : "Add a wallet to your tracked wallets first to create this alert."}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-risk">{error}</p>}
      </form>

      {alerts.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center gap-2 p-12 text-center">
          <Bell className="h-8 w-8 text-ink-faint" />
          <h2 className="font-display text-base font-semibold text-ink">No alerts yet</h2>
          <p className="max-w-sm text-sm text-ink-muted">
            Create an alert above, tied to a token on your watchlist or a wallet you're tracking.
          </p>
        </div>
      ) : (
        <div className="glass divide-y divide-border">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm text-ink">{describeAlert(alert)}</div>
                <div className="mt-0.5 text-xs text-ink-faint">{ALERT_TYPE_META[alert.type].label}</div>
              </div>
              <button
                onClick={() => handleDelete(alert.id)}
                disabled={deletingId === alert.id}
                aria-label="Delete alert"
                className={cn(
                  "shrink-0 rounded-lg p-2 text-ink-faint transition-colors hover:bg-risk/10 hover:text-risk",
                  deletingId === alert.id && "pointer-events-none opacity-50"
                )}
              >
                {deletingId === alert.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
