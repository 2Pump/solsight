import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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