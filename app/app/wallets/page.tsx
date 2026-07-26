import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TrackedWalletsManager } from "@/components/dashboard/tracked-wallets-manager";

export const revalidate = 0; // always reflect the current signed-in user's real tracked wallets

// Auth is already guaranteed by app/app/layout.tsx — no inline sign-in
// check needed here, same as the watchlist page.
export default async function TrackedWalletsPage() {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;

  // Real Prisma read — no sample/hardcoded rows. A brand-new account sees
  // a genuine empty state, not fake wallets.
  const wallets = await prisma.trackedWallet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, address: true, label: true },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Tracked Wallets</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {wallets.length} wallet{wallets.length === 1 ? "" : "s"} tracked. Set up alerts for these
          on the Alerts page.
        </p>
      </div>

      <TrackedWalletsManager initialWallets={wallets} />
    </div>
  );
}
