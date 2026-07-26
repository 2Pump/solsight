import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AlertsManager } from "@/components/dashboard/alerts-manager";

export const revalidate = 0; // always reflect the current signed-in user's real alerts

// Auth is already guaranteed by app/app/layout.tsx.
export default async function AlertsPage() {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;

  const [watchlists, trackedWallets, alerts] = await Promise.all([
    prisma.watchlist.findMany({
      where: { userId },
      include: { items: { include: { token: true } } },
    }),
    prisma.trackedWallet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, address: true, label: true },
    }),
    prisma.alert.findMany({
      where: { userId },
      include: {
        token: { select: { mintAddress: true, symbol: true, name: true } },
        trackedWallet: { select: { address: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // A token could in principle appear on more than one of the user's
  // watchlists (the schema allows multiple watchlists per user, even though
  // today's UI only ever creates one default one) — dedupe by token id so
  // the alert-creation dropdown doesn't show the same token twice.
  const seenTokenIds = new Set<string>();
  const watchlistTokens = watchlists
    .flatMap((w) => w.items)
    .filter((item) => {
      if (seenTokenIds.has(item.tokenId)) return false;
      seenTokenIds.add(item.tokenId);
      return true;
    })
    .map((item) => ({
      mintAddress: item.token.mintAddress,
      symbol: item.token.symbol,
      name: item.token.name,
    }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Alerts</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {alerts.length} active alert{alerts.length === 1 ? "" : "s"}, tied to your watchlist and
          tracked wallets.
        </p>
      </div>

      <AlertsManager
        initialAlerts={alerts}
        watchlistTokens={watchlistTokens}
        trackedWallets={trackedWallets}
      />
    </div>
  );
}
