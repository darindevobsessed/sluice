import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add Video | Gold Miner",
};

export default function AddVideo() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Add Video</h1>
      <p className="text-muted-foreground mb-8">
        Add a new video to your knowledge bank.
      </p>

      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="max-w-md space-y-4">
          <div className="text-6xl mb-4">➕</div>
          <p className="text-lg font-medium text-foreground">
            Video upload form coming soon
          </p>
          <p className="text-muted-foreground">
            You&apos;ll be able to paste YouTube links here to extract knowledge and generate plugin ideas.
          </p>
        </div>
      </div>
    </div>
  );
}
