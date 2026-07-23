import { WalletNetwork, type WalletNode, type WalletEdge } from "@/components/charts/wallet-network";
import { WalletSearchBar } from "@/components/dashboard/wallet-search-bar";
import { shortenAddress } from "@/lib/utils";
import { getWalletFundFlow, getWalletBalances } from "@/lib/helius";
import { ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const revalidate = 60;

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  const [{ edges: fundFlow, txCount }, balances] = await Promise.all([
    getWalletFundFlow(address),
    getWalletBalances(address),
  ]);

  const hasData = fundFlow.length > 0;

  const nodes: WalletNode[] = [
    { address, label: "This wallet", balancePct: 100, isCenter: true },
    ...fundFlow.map((f) => ({
      address: f.counterparty,
      label: shortenAddress(f.counterparty),
      balancePct: Math.max(f.relativeVolume, 6), // floor so small nodes stay visible
      // We never fabricate a "flagged" label — real risk detection isn't
      // built yet. Every counterparty here is real fund-flow data, unflagged.
      flagged: false,
    })),
  ];

  const edges: WalletEdge[] = fundFlow.map((f) => ({
    from: address,
    to: f.counterparty,
    strength: f.relativeVolume / 100,
  }));

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative py-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Wallet Deep-Dive</h1>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ink-faint">
            {shortenAddress(address, 8)}
            <Link href={`https://solscan.io/account/${address}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mb-6 max-w-md">
          <WalletSearchBar />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {hasData ? (
            <WalletNetwork nodes={nodes} edges={edges} />
          ) : (
            <div className="glass flex h-[420px] flex-col items-center justify-center gap-2 p-4 text-center text-sm text-ink-faint">
              <AlertTriangle className="h-6 w-6" />
              {process.env.HELIUS_API_KEY
                ? "No recent transfer activity found for this wallet."
                : "Set HELIUS_API_KEY to enable wallet fund-flow mapping."}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="glass p-5">
              <h3 className="font-display text-sm font-semibold text-ink">Connected wallets</h3>
              {fundFlow.length === 0 ? (
                <p className="mt-3 text-sm text-ink-faint">No connections found.</p>
              ) : (
                <div className="mt-3 divide-y divide-border">
                  {fundFlow.map((f) => (
                    <div
                      key={f.counterparty}
                      className="flex items-center justify-between py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-ink-muted">
                          {shortenAddress(f.counterparty)}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-ink-faint">
                        {f.txCount} tx · {f.relativeVolume}% relative flow
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-ink-faint">
                Based on the last {txCount || 0} transactions. "Relative flow" ranks counterparties
                against each other — it is not a dollar amount or share of holdings.
              </p>
            </div>

            <div className="glass p-5">
              <h3 className="font-display text-sm font-semibold text-ink">Holdings</h3>
              {balances ? (
                <>
                  <div className="mt-2 font-mono text-2xl font-semibold text-ink">
                    {balances.solBalance.toFixed(2)} SOL
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    Plus {balances.tokenCount} other token{balances.tokenCount === 1 ? "" : "s"} held
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">
                  {process.env.HELIUS_API_KEY
                    ? "Balance data unavailable."
                    : "Set HELIUS_API_KEY to show wallet holdings."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}