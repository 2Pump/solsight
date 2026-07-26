"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const TIMEFRAME_OPTIONS = [
  { value: "1s", label: "1 second" },
  { value: "1m", label: "1 minute" },
  { value: "5m", label: "5 minutes" },
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "4h", label: "4 hours" },
  { value: "1d", label: "1 day" },
];

const NOTIFICATION_SWITCHES = [
  {
    key: "notifySignals" as const,
    label: "New signal on a watchlist token",
    desc: "Notify when a token I'm watching gets a new signal",
  },
  {
    key: "notifyRugWarnings" as const,
    label: "Rug warning",
    desc: "Notify immediately on any EXTREME risk signal for watched tokens",
  },
  {
    key: "notifyWalletActivity" as const,
    label: "Tracked wallet activity",
    desc: "Notify when a tracked wallet buys, sells, or moves funds",
  },
];

export interface SettingsData {
  defaultTimeframe: string;
  notifyRugWarnings: boolean;
  notifyWalletActivity: boolean;
  notifySignals: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function SettingsManager({
  initialName,
  initialSettings,
}: {
  initialName: string | null;
  initialSettings: SettingsData;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [settings, setSettings] = useState(initialSettings);
  const [nameState, setNameState] = useState<SaveState>("idle");
  const [prefsState, setPrefsState] = useState<SaveState>("idle");

  async function patch(body: Record<string, unknown>, onDone: (state: SaveState) => void) {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onDone(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => onDone("idle"), 2000);
    } catch {
      onDone("error");
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameState("saving");
    await patch({ name: name.trim() }, setNameState);
  }

  async function handleTimeframeChange(value: string) {
    setSettings((s) => ({ ...s, defaultTimeframe: value }));
    setPrefsState("saving");
    await patch({ defaultTimeframe: value }, setPrefsState);
  }

  async function handleToggle(key: keyof SettingsData) {
    const next = !settings[key];
    setSettings((s) => ({ ...s, [key]: next }));
    setPrefsState("saving");
    await patch({ [key]: next }, setPrefsState);
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Display name</CardTitle>
          <CardDescription>Shown on your public signal votes and comments.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveName} className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="anon_trader"
            maxLength={40}
          />
          <Button type="submit" disabled={nameState === "saving"}>
            {nameState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : nameState === "saved" ? (
              <Check className="h-4 w-4" />
            ) : null}
            {nameState === "saved" ? "Saved" : "Save"}
          </Button>
        </form>
        {nameState === "error" && (
          <p className="mt-2 text-xs text-risk">Couldn't save — try again.</p>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default chart timeframe</CardTitle>
          <CardDescription>The timeframe token pages open to by default.</CardDescription>
        </CardHeader>
        <select
          value={settings.defaultTimeframe}
          onChange={(e) => handleTimeframeChange(e.target.value)}
          className="flex h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-ink transition-colors focus-visible:border-signal/50 focus-visible:outline-none"
        >
          {TIMEFRAME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Card>

      <div className="flex flex-col gap-3">
        {NOTIFICATION_SWITCHES.map((s) => (
          <Card key={s.key} className="flex items-center justify-between">
            <CardHeader className="mb-0">
              <CardTitle>{s.label}</CardTitle>
              <CardDescription>{s.desc}</CardDescription>
            </CardHeader>
            <button
              onClick={() => handleToggle(s.key)}
              className={cn(
                "h-6 w-11 shrink-0 rounded-full transition-colors",
                settings[s.key] ? "bg-signal" : "bg-white/10"
              )}
              aria-pressed={settings[s.key]}
              aria-label={`Toggle ${s.label}`}
            >
              <span
                className={cn(
                  "block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform",
                  settings[s.key] ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </Card>
        ))}
        {prefsState === "error" && (
          <p className="text-xs text-risk">Couldn't save preferences — try again.</p>
        )}
      </div>
    </div>
  );
}
