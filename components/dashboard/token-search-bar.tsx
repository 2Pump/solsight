"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { formatUsd, formatSymbol } from "@/lib/utils";
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
  const [mounted, setMounted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  // createPortal needs `document`, which doesn't exist during server
  // rendering — this guard just delays portal rendering until after the
  // first client-side mount.
  useEffect(() => setMounted(true), []);

  // Previously the results dropdown was positioned with `absolute` relative
  // to this search bar's own container. That put it in the same stacking
  // context as everything else on the page (e.g. the watchlist token
  // grid below it on /app), and even with a higher z-index it could still
  // end up visually trapped behind later-rendered siblings depending on
  // ancestor stacking contexts — which matches the exact "watchlist blocks
  // the dropdown" bug this page has already tried to fix once before.
  // Rendering it through a portal straight onto document.body sidesteps
  // that entirely: its stacking is now independent of any ancestor here.
  // Since it's no longer positioned relative to this container, its
  // position has to be computed manually via getBoundingClientRect and
  // kept in sync on scroll/resize while open.
  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

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
    <div ref={containerRef} className="glass p-5">
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

      {mounted &&
        open &&
        results.length > 0 &&
        dropdownRect &&
        createPortal(
          <>
            {/* Dim backdrop so the results dropdown reads as a clear overlay
                instead of just awkwardly covering whatever's below it (the
                watchlist grid, on /app) — click anywhere on it to dismiss. */}
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed z-50 max-h-72 overflow-y-auto rounded-2xl border border-border bg-surface p-1.5 shadow-2xl"
              style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            >
              {results.map((r) => (
                <button
                  key={r.mintAddress}
                  onClick={() => router.push(`/token/${r.mintAddress}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-medium text-ink">{formatSymbol(r.symbol)}</span>
                    <span className="ml-2 truncate text-xs text-ink-faint">{r.name}</span>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-muted">
                    {formatUsd(r.priceUsd)}
                  </span>
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

      <p className="mt-2 text-xs text-ink-faint">
        Search any token by ticker or paste a mint address directly.
      </p>
    </div>
  );
}