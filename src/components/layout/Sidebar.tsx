import { SidebarLogo } from "./SidebarLogo";
import { SidebarNav } from "./SidebarNav";

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 border-r bg-background">
      <SidebarLogo />
      <SidebarNav />
    </aside>
  );
}
