"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SWITCHES = [
  { key: "watchlist_signal", label: "New signal on a watchlist token", desc: "Notify when a token I'm watching gets a new signal" },
  { key: "rug_warning", label: "Rug warning", desc: "Notify immediately on any EXTREME risk signal for watched tokens" },
  { key: "wallet_move", label: "Tracked wallet activity", desc: "Notify when a tracked wallet buys, sells, or moves funds" },
];

export default function AlertsPage() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    watchlist_signal: true,
    rug_warning: true,
    wallet_move: false,
  });

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Alerts</h1>
      <div className="flex flex-col gap-3">
        {SWITCHES.map((s) => (
          <Card key={s.key} className="flex items-center justify-between">
            <CardHeader className="mb-0">
              <CardTitle>{s.label}</CardTitle>
              <CardDescription>{s.desc}</CardDescription>
            </CardHeader>
            <button
              onClick={() => setEnabled((e) => ({ ...e, [s.key]: !e[s.key] }))}
              className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
                enabled[s.key] ? "bg-signal" : "bg-white/10"
              }`}
              aria-pressed={enabled[s.key]}
              aria-label={`Toggle ${s.label}`}
            >
              <span
                className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${
                  enabled[s.key] ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
