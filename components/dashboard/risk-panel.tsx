import { CheckCircle2, XCircle, ShieldQuestion } from "lucide-react";
import { cn, formatUsd, formatPct } from "@/lib/utils";

export interface RiskPanelData {
  rugScore: number;
  lpLocked: boolean | null;
  lpBurned: boolean | null;
  mintAuthorityRevoked: boolean | null;
  freezeAuthorityRevoked: boolean | null;
  topHolderPct: number | null;
  liquidityUsd: number | null;
}

function Check({ label, value }: { label: string; value: boolean | null }) {
  const Icon = value === null ? ShieldQuestion : value ? CheckCircle2 : XCircle;
  const color = value === null ? "text-ink-faint" : value ? "text-pulse" : "text-risk";
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={cn("flex items-center gap-1.5 font-medium", color)}>
        <Icon className="h-4 w-4" />
        {value === null ? "Unknown" : value ? "Yes" : "No"}
      </span>
    </div>
  );
}

export function RiskPanel({ data }: { data: RiskPanelData }) {
  const riskColor =
    data.rugScore < 25 ? "text-pulse" : data.rugScore < 50 ? "text-amber" : "text-risk";

  return (
    <div className="glass p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">Rug Screener</h3>
        <span className={cn("font-mono text-2xl font-semibold", riskColor)}>
          {data.rugScore}
          <span className="text-xs text-ink-faint">/100</span>
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pulse via-amber to-risk"
          style={{ width: `${data.rugScore}%` }}
        />
      </div>

      <div className="mt-4 divide-y divide-border">
        <Check label="LP locked" value={data.lpLocked} />
        <Check label="LP burned" value={data.lpBurned} />
        <Check label="Mint authority revoked" value={data.mintAuthorityRevoked} />
        <Check label="Freeze authority revoked" value={data.freezeAuthorityRevoked} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <div className="text-xs text-ink-faint">Top 10 holders</div>
          <div className="font-mono text-ink">{formatPct(data.topHolderPct)}</div>
        </div>
        <div>
          <div className="text-xs text-ink-faint">Liquidity</div>
          <div className="font-mono text-ink">{formatUsd(data.liquidityUsd)}</div>
        </div>
      </div>
    </div>
  );
}
