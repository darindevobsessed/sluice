import { Pickaxe } from 'lucide-react'

interface SidebarLogoProps {
  collapsed?: boolean
}

export function SidebarLogo({ collapsed = false }: SidebarLogoProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-5">
      <Pickaxe className="h-6 w-6 text-primary shrink-0" />
      {!collapsed && (
        <span className="text-lg font-semibold overflow-hidden whitespace-nowrap">
          Gold Miner
        </span>
      )}
    </div>
  )
}
