"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Radar, Wallet, Bell, Settings } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Watchlists", icon: LayoutGrid },
  { href: "/feed", label: "Signal Feed", icon: Radar },
  { href: "/dashboard/wallets", label: "Tracked Wallets", icon: Wallet },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-24 hidden h-fit w-56 shrink-0 md:block">
      <nav className="glass flex flex-col gap-1 p-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-signal/15 text-ink"
                  : "text-ink-muted hover:bg-white/5 hover:text-ink"
              )}
            >
              <item.icon className={cn("h-4 w-4", active && "text-signal-soft")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
