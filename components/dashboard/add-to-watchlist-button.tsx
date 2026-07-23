"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Star, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AddToWatchlistButton({ mintAddress }: { mintAddress: string }) {
  const { data: session, status } = useSession();
  const [state, setState] = useState<"idle" | "loading" | "added" | "error">("idle");

  async function handleClick() {
    if (!session?.user) {
      // Real auth gate — no fake "added!" state for a signed-out visitor.
      window.location.href = "/auth";
      return;
    }

    setState("loading");
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintAddress }),
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
        <Loader2 className="h-4 w-4 animate-spin" /> Add to watchlist
      </Button>
    );
  }

  if (state === "added") {
    return (
      <Button variant="outline" size="sm" disabled className="text-pulse">
        <Check className="h-4 w-4" /> On watchlist
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
      {state === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className="h-4 w-4" />
      )}
      {state === "error" ? "Couldn't add — try again" : "Add to watchlist"}
    </Button>
  );
}