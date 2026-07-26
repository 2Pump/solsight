"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { RadarMark } from "@/components/shared/radar-mark";
import { Button } from "@/components/ui/button";
import { LogOut, Wallet } from "lucide-react";

const NAV = [
  { href: "/feed", label: "Signal Feed" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "#how-it-works", label: "How it works" },
];

// Shown instead of the marketing nav once signed in — this is what was
// missing before: the header hid all navigation entirely while "in the
// app," leaving no way back to the feed/watchlist from a token or wallet
// detail page.
const APP_NAV = [
  { href: "/app", label: "Watchlist" },
  { href: "/feed", label: "Signal Feed" },
];

const APP_PREFIXES = ["/app", "/feed", "/token", "/wallet"];

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isApp = APP_PREFIXES.some((p) => pathname?.startsWith(p));

  const walletAddress = (session?.user as { walletAddress?: string } | undefined)?.walletAddress;
  const identity = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : session?.user?.name ?? null;

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <div className="glass flex items-center justify-between px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <Link href="/" className="flex items-center gap-2.5">
            <RadarMark className="h-7 w-7" />
            <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
              SolSight
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {(isApp ? APP_NAV : NAV).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {isApp ? (
            <div className="flex items-center gap-2">
              {identity && (
                <span className="hidden items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs text-ink-muted sm:flex">
                  <Wallet className="h-3.5 w-3.5" />
                  {identity}
                </span>
              )}
              <Button onClick={() => signOut({ callbackUrl: "/" })} variant="outline" size="sm">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
            </div>
          ) : (
            <Button asChild size="sm">
              <Link href="/feed">Launch App</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
