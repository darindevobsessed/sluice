import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Gold Miner</CardTitle>
          <CardDescription>
            Extract knowledge from YouTube videos and generate Claude Code plugins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Your knowledge bank is empty. Add your first video to get started.
          </p>
          <Button className="w-full">Add Video</Button>
        </CardContent>
      </Card>
    </div>
  );
}
