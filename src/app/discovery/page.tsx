import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discovery | Gold Miner",
};

export default function Discovery() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Discovery</h1>
      <p className="text-muted-foreground mb-8">
        Follow channels to discover new content.
      </p>

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="max-w-md space-y-4">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-lg font-medium text-foreground">
            Channel discovery coming soon
          </p>
          <p className="text-muted-foreground">
            Follow your favorite YouTube channels and discover new videos automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
