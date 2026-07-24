"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RadarMark } from "@/components/shared/radar-mark";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/feed", label: "Signal Feed" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "#how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const isApp = pathname?.startsWith("/dashboard");

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

          {!isApp && (
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            <Link href="/feed" className="hidden text-sm text-ink-muted hover:text-ink sm:block">
              {isApp ? "" : "View live feed"}
            </Link>
            <Button asChild size="sm" className={cn(isApp && "hidden")}>
              <Link href="/feed">Launch App</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}