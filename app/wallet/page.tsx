import { WalletSearchBar } from "@/components/dashboard/wallet-search-bar";
import { shortenAddress } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Radar, ExternalLink } from "lucide-react";

export const revalidate = 0;

/**
 * Landing page for wallet lookup — /wallet/[address] needs a specific
 * address in the URL, so the top-nav "Wallet Deep-Dive" link needs
 * somewhere real to point to. Doubles as a quick-jump list into the
 * user's real tracked wallets, rather than just being a bare search box.
 */
export default async function WalletIndexPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  const userId = (session.user as { id: string }).id;

  const trackedWallets = await prisma.trackedWallet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, address: true, label: true },
  });

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative py-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Wallet Deep-Dive</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Look up any Solana wallet's fund-flow map and holdings, or jump into one you're already
            tracking.
          </p>
        </div>

        <div className="mb-6 max-w-md">
          <WalletSearchBar />
        </div>

        {trackedWallets.length > 0 && (
          <div className="max-w-md">
            <h2 className="mb-2 text-sm font-medium text-ink">Your tracked wallets</h2>
            <div className="glass divide-y divide-border">
              {trackedWallets.map((w: { id: string; address: string; label: string | null }) => (
                <Link
                  key={w.id}
                  href={`/wallet/${w.address}`}
                  className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <Radar className="h-4 w-4 text-signal-soft" />
                    <div>
                      <div className="font-mono text-sm text-ink">{shortenAddress(w.address, 6)}</div>
                      {w.label && <div className="text-xs text-ink-faint">{w.label}</div>}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}