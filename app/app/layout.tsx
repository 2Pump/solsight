import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

/**
 * Gate for the entire authenticated app section (watchlist, wallets,
 * alerts, settings) in one place — every page under /app/* is protected
 * by this single check rather than repeating it per-page. /feed,
 * /token/[address], and /wallet/[address] live outside this folder (their
 * URLs are meant to stay simple/shareable) and have their own equivalent
 * checks.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  return (
    <div className="relative">
      {/* Decorative background grid — kept in its own empty layer so the
          mask-image fade doesn't apply to (and hide) real page content. */}
      <div className="pointer-events-none absolute inset-0 bg-signal-grid" />
      <div className="container relative flex gap-6 py-6">
        <DashboardSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
