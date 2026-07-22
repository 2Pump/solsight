"use client";

import { signIn } from "next-auth/react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { RadarMark } from "@/components/shared/radar-mark";
import { Wallet } from "lucide-react";
import bs58 from "bs58";

export default function AuthPage() {
  const { login, ready } = usePrivy();
  const { wallets } = useWallets();

  async function handleWalletSignIn() {
    // Opens Privy's connect modal if no wallet is attached yet.
    if (wallets.length === 0) {
      login();
      return;
    }

    const wallet = wallets[0];
    const message = `Sign in to SolSight — ${new Date().toISOString()}`;
    const encoded = new TextEncoder().encode(message);

    // Privy's Solana wallet interface exposes signMessage on the underlying provider.
    const signature = await (
      wallet as unknown as { signMessage: (msg: Uint8Array) => Promise<Uint8Array> }
    ).signMessage(encoded);

    await signIn("solana", {
      address: wallet.address,
      signature: bs58.encode(signature),
      message,
      redirectTo: "/dashboard",
    });
  }

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

        <div className="mt-8 flex flex-col gap-3">
          <Button onClick={handleWalletSignIn} disabled={!ready} size="lg">
            <Wallet className="h-4 w-4" /> Connect Solana wallet
          </Button>
          <Button
            onClick={() => signIn("discord", { redirectTo: "/dashboard" })}
            variant="outline"
            size="lg"
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