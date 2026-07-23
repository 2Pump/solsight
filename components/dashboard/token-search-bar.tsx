"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { formatUsd } from "@/lib/utils";
import type { TokenSearchResult } from "@/lib/market-data";

// A raw mint address pasted directly skips the search-and-pick step and
// jumps straight to the token page — same shortcut as the wallet search bar.
const ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function TokenSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (ADDRESS_PATTERN.test(trimmed) || trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (ADDRESS_PATTERN.test(trimmed)) {
      router.push(`/token/${trimmed}`);
    } else if (results[0]) {
      router.push(`/token/${results[0].mintAddress}`);
    }
  }

  return (
    <div className="glass relative p-5">
      <label htmlFor="token-search" className="mb-2 block text-sm font-medium text-ink">
        Look up a token
      </label>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="token-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Ticker (BONK), name, or mint address…"
            className="font-mono text-sm"
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint" />
          )}
        </div>
        <button
          type="submit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal text-white hover:bg-signal-soft"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      {open && results.length > 0 && (
        <div className="glass absolute left-5 right-5 top-full z-10 mt-2 max-h-72 overflow-y-auto p-1.5">
          {results.map((r) => (
            <button
              key={r.mintAddress}
              onClick={() => router.push(`/token/${r.mintAddress}`)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
            >
              <div className="min-w-0">
                <span className="font-mono font-medium text-ink">${r.symbol}</span>
                <span className="ml-2 truncate text-xs text-ink-faint">{r.name}</span>
              </div>
              <span className="shrink-0 font-mono text-xs text-ink-muted">
                {formatUsd(r.priceUsd)}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-ink-faint">
        Search any token by ticker or paste a mint address directly.
      </p>
    </div>
  );
}