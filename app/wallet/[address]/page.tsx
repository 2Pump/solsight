import { WalletNetwork, type WalletNode, type WalletEdge } from "@/components/charts/wallet-network";
import { shortenAddress, formatCompact } from "@/lib/utils";
import { ExternalLink, ShieldAlert } from "lucide-react";
import Link from "next/link";

function sampleGraph(center: string): { nodes: WalletNode[]; edges: WalletEdge[] } {
  const nodes: WalletNode[] = [
    { address: center, label: "This wallet", balancePct: 100, isCenter: true },
    { address: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin", balancePct: 34, label: "7xKX…9pQm" },
    { address: "3kLmT4zP2yGh8vDxNqW1sJfR7cVbXoAe6yUiHm5aQ9wZ", balancePct: 21, label: "3kLm…9wZ", flagged: true },
    { address: "8pRtY6nXzKQm4dCvBaLj9WsE2fGh3iUoP1rTyVxNmQ7k", balancePct: 15, label: "8pRt…7k" },
    { address: "5vNcE7mXqY3wRtZ8pLjD2sKf9GhB4iUoA6yTxVmQnW1e", balancePct: 9, label: "5vNc…1e" },
    { address: "2fHmQ9wRtY6nXzKvBaLj4dCoP1rTyVxE7mXqY3sKf8Gh", balancePct: 6, label: "2fHm…8Gh" },
  ];
  const edges: WalletEdge[] = nodes
    .slice(1)
    .map((n) => ({ from: center, to: n.address, strength: n.balancePct / 40 }));
  return { nodes, edges };
}

export default async function WalletDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const { nodes, edges } = sampleGraph(address);

  return (
    <div className="bg-signal-grid">
      <div className="container py-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Wallet Deep-Dive</h1>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-sm text-ink-faint">
            {shortenAddress(address, 8)}
            <Link href={`https://solscan.io/account/${address}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <WalletNetwork nodes={nodes} edges={edges} />

          <div className="flex flex-col gap-4">
            <div className="glass p-5">
              <h3 className="font-display text-sm font-semibold text-ink">Connected wallets</h3>
              <div className="mt-3 divide-y divide-border">
                {nodes.slice(1).map((n) => (
                  <div key={n.address} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      {n.flagged && <ShieldAlert className="h-3.5 w-3.5 text-risk" />}
                      <span className="font-mono text-ink-muted">{n.label}</span>
                    </div>
                    <span className="font-mono text-xs text-ink-faint">{n.balancePct}% shared flow</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-5">
              <h3 className="font-display text-sm font-semibold text-ink">Portfolio value</h3>
              <div className="mt-2 font-mono text-2xl font-semibold text-ink">
                {formatCompact(482_300)}
              </div>
              <p className="mt-1 text-xs text-ink-faint">Across 14 tokens · updated 2m ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
