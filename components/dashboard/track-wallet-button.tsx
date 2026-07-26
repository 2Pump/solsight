"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Radar, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function TrackWalletButton({
  address,
  initiallyTracked,
}: {
  address: string;
  initiallyTracked: boolean;
}) {
  const { data: session, status } = useSession();
  const [state, setState] = useState<"idle" | "loading" | "added" | "error">(
    initiallyTracked ? "added" : "idle"
  );

  async function handleClick() {
    if (!session?.user) {
      window.location.href = "/auth";
      return;
    }
    if (state === "added") return; // already tracked — this button doesn't handle untracking

    setState("loading");
    try {
      const res = await fetch("/api/tracked-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      setState("added");
    } catch {
      setState("error");
    }
  }

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" /> Track wallet
      </Button>
    );
  }

  if (state === "added") {
    return (
      <Button variant="outline" size="sm" disabled className="text-pulse">
        <Check className="h-4 w-4" /> Tracked
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={state === "loading"}
      className={cn(state === "error" && "text-risk")}
    >
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
      {state === "error" ? "Couldn't track — try again" : "Track wallet"}
    </Button>
  );
}