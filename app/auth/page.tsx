"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { RadarMark } from "@/components/shared/radar-mark";
import { Wallet, Loader2, AlertTriangle } from "lucide-react";
import bs58 from "bs58";

export default function AuthPage() {
  const router = useRouter();
  const { login, ready } = usePrivy();
  const { wallets } = useWallets();
  const [status, setStatus] = useState<"idle" | "signing" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleWalletSignIn() {
    setError(null);

    // Opens Privy's connect modal if no wallet is attached yet.
    if (wallets.length === 0) {
      login();
      return;
    }

    const wallet = wallets[0];
    const message = `Sign in to SolSight — ${new Date().toISOString()}`;
    const encoded = new TextEncoder().encode(message);

    let signature: Uint8Array;
    try {
      setStatus("signing");
      // Privy's Solana wallet interface exposes signMessage on the underlying
      // provider — but the exact shape can vary by wallet type/connector, so
      // this is wrapped rather than assumed to always succeed.
      signature = await (
        wallet as unknown as { signMessage: (msg: Uint8Array) => Promise<Uint8Array> }
      ).signMessage(encoded);
    } catch (err) {
      console.error("[auth] wallet signMessage failed:", err);
      setError(
        "Couldn't get a signature from your wallet. Check the wallet's popup/approval " +
          "window (it may be hidden behind this one), or try disconnecting and reconnecting."
      );
      setStatus("idle");
      return;
    }

    try {
      setStatus("verifying");
      // redirect: false so we can see exactly what happened instead of a
      // silent implicit redirect — this was previously failing invisibly
      // with no error shown and no navigation on failure.
      const result = await signIn("solana", {
        address: wallet.address,
        signature: bs58.encode(signature),
        message,
        redirect: false,
      });

      if (result?.error) {
        console.error("[auth] signIn('solana') rejected:", result.error);
        setError(
          "Sign-in was rejected by the server. This usually means the signature couldn't be " +
            "verified — try again, and make sure the connected wallet address matches the one " +
            "that signed the message."
        );
        setStatus("idle");
        return;
      }

      // Success — navigate explicitly and force a refresh so the session
      // (and anything gated on it, like the dashboard) picks up immediately
      // rather than waiting on a stale client-side session cache.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("[auth] signIn threw:", err);
      setError("Something went wrong completing sign-in. Please try again.");
      setStatus("idle");
    }
  }

  const busy = status !== "idle";

  return (
    <div className="relative flex min-h-[calc(100vh-88px)] items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="glass glow-violet relative w-full max-w-sm p-8 text-center">
        <RadarMark className="mx-auto h-9 w-9" />
        <h1 className="mt-4 font-display text-xl font-semibold text-ink">
          Turn on your radar
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign in to save watchlists, track wallets, and vote on signals.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-risk/30 bg-risk/10 p-3 text-left text-xs text-risk">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Button onClick={handleWalletSignIn} disabled={!ready || busy} size="lg">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {status === "signing" ? "Waiting for wallet signature…" : "Verifying…"}
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" /> Connect Solana wallet
              </>
            )}
          </Button>
          <Button
            onClick={() => signIn("discord", { redirectTo: "/dashboard" })}
            variant="outline"
            size="lg"
            disabled={busy}
          >
            Continue with Discord
          </Button>
        </div>

        <p className="mt-6 text-xs text-ink-faint">
          By continuing you agree this is a research tool, not financial advice.
        </p>
      </div>
    </div>
  );
}