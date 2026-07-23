"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

// Solana addresses are base58, 32-44 characters. This is a loose sanity
// check, not full validation — Helius will simply return no data for an
// invalid or non-wallet address (see the empty-state handling on the
// wallet page itself).
const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function WalletSearchBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!ADDRESS_PATTERN.test(trimmed)) {
      setError("That doesn't look like a valid Solana address.");
      return;
    }
    setError(null);
    router.push(`/wallet/${trimmed}`);
  }

  return (
    <form onSubmit={handleSubmit} className="glass p-5">
      <label htmlFor="wallet-search" className="mb-2 block text-sm font-medium text-ink">
        Look up a wallet
      </label>
      <div className="flex gap-2">
        <Input
          id="wallet-search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Paste a Solana wallet address…"
          className="font-mono text-sm"
        />
        <Button type="submit" size="default">
          <Search className="h-4 w-4" /> View
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-risk">{error}</p>}
      <p className="mt-2 text-xs text-ink-faint">
        Note: this must be a wallet address, not a token mint address — those look similar but
        aren't interchangeable.
      </p>
    </form>
  );
}