import { WalletNetwork, type WalletNode, type WalletEdge } from "@/components/charts/wallet-network";
import { WalletSearchBar } from "@/components/dashboard/wallet-search-bar";
import { TrackWalletButton } from "@/components/dashboard/track-wallet-button";
import { shortenAddress, formatUsd, formatSymbol, formatRelativeTime } from "@/lib/utils";
import { getWalletFundFlow, getWalletBalances } from "@/lib/helius";
import { prisma } from "@/lib/prisma";
import { ExternalLink, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const revalidate = 60;

// A counterparty needs a real lean toward one direction before we label it
// — anything close to 50/50 is honestly "balanced," not arbitrarily
// assigned to whichever side has one more transaction.
function directionFor(inflowCount: number, outflowCount: number): "inflow" | "outflow" | "balanced" {
  const total = inflowCount + outflowCount;
  if (total === 0) return "balanced";
  const inflowShare = inflowCount / total;
  if (inflowShare >= 0.65) return "inflow";
  if (inflowShare <= 0.35) return "outflow";
  return "balanced";
}

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  const userId = (session.user as { id: string }).id;

  const { address } = await params;

  const [{ edges: fundFlow, txCount }, balances, existingTrackedWallet] = await Promise.all([
    getWalletFundFlow(address),
    getWalletBalances(address),
    prisma.trackedWallet.findUnique({ where: { userId_address: { userId, address } } }),
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
    direction: directionFor(f.inflowCount, f.outflowCount),
    txCount: f.txCount,
    lastTxAt: f.lastTxAt,
  }));

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative py-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Wallet Deep-Dive</h1>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ink-faint">
              {shortenAddress(address, 8)}
              <Link href={`https://solscan.io/account/${address}`} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <TrackWalletButton address={address} initiallyTracked={!!existingTrackedWallet} />
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
                  {fundFlow.map((f) => {
                    const direction = directionFor(f.inflowCount, f.outflowCount);
                    return (
                      <Link
                        key={f.counterparty}
                        href={`/wallet/${f.counterparty}`}
                        className="-mx-1 flex items-center justify-between rounded-lg px-1 py-2.5 text-sm transition-colors hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "h-1.5 w-1.5 shrink-0 rounded-full " +
                              (direction === "inflow"
                                ? "bg-pulse"
                                : direction === "outflow"
                                  ? "bg-amber"
                                  : "bg-signal")
                            }
                          />
                          <span className="font-mono text-ink-muted">
                            {shortenAddress(f.counterparty)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs text-ink-faint">
                            {f.txCount} tx · {f.relativeVolume}% relative flow
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            Last activity {formatRelativeTime(f.lastTxAt)}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-xs text-ink-faint">
                Based on the last {txCount || 0} transactions. "Relative flow" ranks counterparties
                against each other — it is not a dollar amount or share of holdings. Dot color shows
                real transaction direction: teal sends to this wallet, amber receives from it.
              </p>
            </div>

            <div className="glass p-5">
              <h3 className="font-display text-sm font-semibold text-ink">Holdings</h3>
              {balances ? (
                <>
                  <div className="mt-2 font-mono text-2xl font-semibold text-ink">
                    {balances.totalUsdValue !== null
                      ? formatUsd(balances.totalUsdValue)
                      : `${balances.solBalance.toFixed(2)} SOL`}
                  </div>
                  <p className="mt-1 text-xs text-ink-faint">
                    {balances.solBalance.toFixed(2)} SOL
                    {balances.solUsdValue !== null && ` (${formatUsd(balances.solUsdValue)})`}
                    {balances.tokenCount > 0 &&
                      ` · plus ${balances.tokenCount} other token${balances.tokenCount === 1 ? "" : "s"}`}
                  </p>
                  {balances.topHoldings.length > 0 && (
                    <div className="mt-3 divide-y divide-border border-t border-border">
                      {balances.topHoldings.map((h) => (
                        <div
                          key={h.mint}
                          className="flex items-center justify-between py-2 text-sm"
                        >
                          <span className="font-mono text-ink-muted">
                            {h.symbol ? formatSymbol(h.symbol) : shortenAddress(h.mint)}
                          </span>
                          <span className="font-mono text-xs text-ink-faint">
                            {h.usdValue !== null ? formatUsd(h.usdValue) : h.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-faint">
                  {process.env.HELIUS_API_KEY
                    ? "Balance data unavailable — the wallet balances lookup failed for this address."
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