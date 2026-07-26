"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Loader2, Wallet as WalletIcon, ExternalLink } from "lucide-react";
import { shortenAddress, cn } from "@/lib/utils";

const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface TrackedWalletData {
  id: string;
  address: string;
  label: string | null;
}

export function TrackedWalletsManager({ initialWallets }: { initialWallets: TrackedWalletData[] }) {
  const [wallets, setWallets] = useState(initialWallets);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!ADDRESS_PATTERN.test(trimmed)) {
      setError("That doesn't look like a valid Solana address.");
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/tracked-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed, label: label.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? data.error ?? "Couldn't add that wallet.");
        return;
      }
      // Replace-or-prepend: POST upserts, so re-adding an already-tracked
      // address (e.g. to update its label) updates the existing row rather
      // than creating a duplicate — mirror that here instead of blindly
      // prepending a second entry for the same address.
      setWallets((prev) => {
        const existingIndex = prev.findIndex((w) => w.id === data.wallet.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = data.wallet;
          return next;
        }
        return [data.wallet, ...prev];
      });
      setAddress("");
      setLabel("");
    } catch {
      setError("Couldn't add that wallet — try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/tracked-wallets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setWallets((prev) => prev.filter((w) => w.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="glass mb-6 p-5">
        <label htmlFor="tracked-wallet-address" className="mb-2 block text-sm font-medium text-ink">
          Track a new wallet
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="tracked-wallet-address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setError(null);
            }}
            placeholder="Paste a Solana wallet address…"
            className="flex-1 font-mono text-sm"
            autoComplete="off"
          />
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="sm:w-48"
            maxLength={60}
          />
          <Button type="submit" disabled={adding} className="shrink-0">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
        {error && <p className="mt-2 text-xs text-risk">{error}</p>}
      </form>

      {wallets.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center gap-2 p-12 text-center">
          <WalletIcon className="h-8 w-8 text-ink-faint" />
          <h2 className="font-display text-base font-semibold text-ink">No tracked wallets yet</h2>
          <p className="max-w-sm text-sm text-ink-muted">
            Paste any Solana wallet address above to start tracking it — you'll be able to view its
            fund-flow map and set up activity alerts.
          </p>
        </div>
      ) : (
        <div className="glass divide-y divide-border">
          {wallets.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-white/5"
            >
              <Link href={`/wallet/${w.address}`} className="group min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-mono text-sm text-ink">
                  {shortenAddress(w.address, 6)}
                  <ExternalLink className="h-3 w-3 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                {w.label && <div className="mt-0.5 text-xs text-ink-faint">{w.label}</div>}
              </Link>
              <button
                onClick={() => handleDelete(w.id)}
                disabled={deletingId === w.id}
                aria-label={`Stop tracking ${w.address}`}
                className={cn(
                  "shrink-0 rounded-lg p-2 text-ink-faint transition-colors hover:bg-risk/10 hover:text-risk",
                  deletingId === w.id && "pointer-events-none opacity-50"
                )}
              >
                {deletingId === w.id ? (
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
