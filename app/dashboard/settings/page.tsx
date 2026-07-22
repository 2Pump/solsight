import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Display name</CardTitle>
          <CardDescription>Shown on your public signal votes and comments.</CardDescription>
        </CardHeader>
        <div className="flex gap-2">
          <Input placeholder="anon_trader" />
          <Button>Save</Button>
        </div>
      </Card>
    </div>
  );
}
