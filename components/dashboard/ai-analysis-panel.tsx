import { BrainCircuit, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChartAnalysisResult } from "@/lib/anthropic";

const BIAS_META = {
  bullish: { icon: TrendingUp, color: "text-pulse", label: "Bullish" },
  bearish: { icon: TrendingDown, color: "text-risk", label: "Bearish" },
  neutral: { icon: Minus, color: "text-ink-muted", label: "Neutral" },
};

export function AiAnalysisPanel({ analysis }: { analysis: ChartAnalysisResult }) {
  const meta = BIAS_META[analysis.bias];

  return (
    <div className="glass p-6">
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-signal-soft" />
        <h3 className="font-display text-sm font-semibold text-ink">AI Chart Analysis</h3>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-ink-faint">
          claude-sonnet-4-6
        </span>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className={cn("flex items-center gap-1.5 text-sm font-medium", meta.color)}>
          <meta.icon className="h-4 w-4" />
          {meta.label}
        </div>
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-risk via-amber to-pulse"
              style={{ width: `${analysis.probabilityUp * 100}%` }}
            />
          </div>
        </div>
        <span className="font-mono text-sm text-ink">
          {Math.round(analysis.probabilityUp * 100)}%
        </span>
      </div>

      <p className="text-sm leading-relaxed text-ink-muted">{analysis.summary}</p>

      {analysis.keyLevels.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {analysis.keyLevels.map((level) => (
            <span
              key={level.label}
              className="badge border-signal/25 bg-signal/10 text-signal-soft"
            >
              {level.label} · ${level.price.toFixed(6)}
            </span>
          ))}
        </div>
      )}

      {analysis.risks.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {analysis.risks.map((risk, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-risk">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-risk" />
              {risk}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 border-t border-border pt-3 text-[11px] text-ink-faint">
        AI-generated interpretation of public chart and on-chain data. Not financial advice.
      </p>
    </div>
  );
}
