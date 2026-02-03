import { Pickaxe } from "lucide-react";

export function SidebarLogo() {
  return (
    <div className="flex items-center gap-2 px-4 py-5">
      <Pickaxe className="h-6 w-6 text-primary" />
      <span className="text-lg font-semibold">Gold Miner</span>
    </div>
  );
}
