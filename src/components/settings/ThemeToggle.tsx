"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // Use useSyncExternalStore to safely check if component is mounted
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-3 rounded-lg border border-border bg-card p-4">
          <div className="h-4 w-4 rounded-full border-2 border-muted" />
          <div className="h-4 w-20 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <RadioGroup value={theme} onValueChange={setTheme}>
      <div className="space-y-3">
        <div className="flex items-center space-x-3 rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="system" id="system" />
          <Label
            htmlFor="system"
            className="flex-1 cursor-pointer font-normal"
          >
            <div className="font-medium">System</div>
            <div className="text-sm text-muted-foreground">
              Use system theme preference
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-3 rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="light" id="light" />
          <Label htmlFor="light" className="flex-1 cursor-pointer font-normal">
            <div className="font-medium">Light</div>
            <div className="text-sm text-muted-foreground">
              Always use light theme
            </div>
          </Label>
        </div>
        <div className="flex items-center space-x-3 rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="dark" id="dark" />
          <Label htmlFor="dark" className="flex-1 cursor-pointer font-normal">
            <div className="font-medium">Dark</div>
            <div className="text-sm text-muted-foreground">
              Always use dark theme
            </div>
          </Label>
        </div>
      </div>
    </RadioGroup>
  );
}
