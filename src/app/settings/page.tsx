import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | Gold Miner",
};

export default function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">
        Manage your preferences and application settings.
      </p>

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="max-w-md space-y-4">
          <div className="text-6xl mb-4">⚙️</div>
          <p className="text-lg font-medium text-foreground">
            Settings panel coming soon
          </p>
          <p className="text-muted-foreground">
            Theme toggle and other preferences will be available here.
          </p>
        </div>
      </div>
    </div>
  );
}
