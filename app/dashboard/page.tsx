import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { TokenCard, type TokenCardData } from "@/components/dashboard/token-card";
import { TokenSearchBar } from "@/components/dashboard/token-search-bar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Star } from "lucide-react";

export const revalidate = 0; // always reflect the current signed-in user's real watchlist

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Star className="h-8 w-8 text-ink-faint" />
        <h1 className="font-display text-xl font-semibold text-ink">Sign in to see your watchlist</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          Your watchlist is tied to your account, so we need you signed in before we can show it.
        </p>
        <Link
          href="/auth"
          className="mt-2 rounded-xl bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-soft"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const userId = (session.user as { id: string }).id;

  // Real Prisma read — the default watchlist and its tokens, freshest data
  // first. No sample/hardcoded rows: a brand-new account genuinely sees an
  // empty state below rather than fake tokens.
  const watchlist = await prisma.watchlist.findFirst({
    where: { userId, isDefault: true },
    include: { items: { include: { token: true }, orderBy: { addedAt: "desc" } } },
  });

  type WatchlistItemWithToken = Prisma.WatchlistItemGetPayload<{ include: { token: true } }>;

  const tokens: TokenCardData[] = (watchlist?.items ?? []).map((item: WatchlistItemWithToken) => ({
    mintAddress: item.token.mintAddress,
    symbol: item.token.symbol,
    name: item.token.name,
    imageUrl: item.token.imageUrl,
    priceUsd: item.token.priceUsd,
    priceChange24h: item.token.priceChange24h,
    marketCapUsd: item.token.marketCapUsd,
    rugScore: item.token.rugScore,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">My Watchlist</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {tokens.length} token{tokens.length === 1 ? "" : "s"} tracked
          </p>
        </div>
      </div>

      <div className="mb-6">
        <TokenSearchBar />
      </div>

      {tokens.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center gap-2 p-12 text-center">
          <Star className="h-8 w-8 text-ink-faint" />
          <h2 className="font-display text-base font-semibold text-ink">Your watchlist is empty</h2>
          <p className="max-w-sm text-sm text-ink-muted">
            Search for a token above, or open any token page and hit "Add to watchlist" to track it
            here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tokens.map((token) => (
            <TokenCard key={token.mintAddress} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}