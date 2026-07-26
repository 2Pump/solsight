"use client";

import { SessionProvider } from "next-auth/react";
import { PrivyProvider } from "@privy-io/react-auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
        config={{
          appearance: {
            theme: "dark",
            accentColor: "#7C5CFF",
            logo: "/logo-mark.svg",
          },
          embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
          loginMethods: ["wallet", "discord", "email"],
        }}
      >
        {children}
      </PrivyProvider>
    </SessionProvider>
  );
}