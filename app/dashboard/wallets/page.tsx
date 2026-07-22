import Link from "next/link";
import { Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";

const TRACKED = [
  { address: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin", label: "Early WIF buyer" },
  { address: "3kLmT4zP2yGh8vDxNqW1sJfR7cVbXoAe6yUiHm5aQ9wZ", label: "Flagged — repeat rugger" },
];

export default function TrackedWalletsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Tracked Wallets</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Get notified when these wallets move funds or open new positions.
          </p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Track wallet
        </Button>
      </div>

      <div className="glass divide-y divide-border">
        {TRACKED.map((w) => (
          <Link
            key={w.address}
            href={`/wallet/${w.address}`}
            className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/5"
          >
            <div>
              <div className="font-mono text-sm text-ink">{shortenAddress(w.address, 6)}</div>
              <div className="text-xs text-ink-faint">{w.label}</div>
            </div>
            <ExternalLink className="h-4 w-4 text-ink-faint" />
          </Link>
        ))}
      </div>
    </div>
  );
}
