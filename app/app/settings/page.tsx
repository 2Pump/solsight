import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsManager } from "@/components/dashboard/settings-manager";

export const revalidate = 0; // always reflect the current signed-in user's real settings

// Auth is already guaranteed by app/app/layout.tsx.
export default async function SettingsPage() {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;

  // Lazily create a settings row on first visit rather than requiring a
  // separate signup step — every user eventually needs one (the token page
  // reads defaultTimeframe on every visit).
  const [settings, user] = await Promise.all([
    prisma.userSettings.upsert({ where: { userId }, update: {}, create: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Settings</h1>
      <SettingsManager
        initialName={user?.name ?? null}
        initialSettings={{
          defaultTimeframe: settings.defaultTimeframe,
          notifyRugWarnings: settings.notifyRugWarnings,
          notifyWalletActivity: settings.notifyWalletActivity,
          notifySignals: settings.notifySignals,
        }}
      />
    </div>
  );
}
