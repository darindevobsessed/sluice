import { Pickaxe, ChevronLeft, ChevronRight } from 'lucide-react'
import { useSidebar } from '@/components/providers/SidebarProvider'
import { Button } from '@/components/ui/button'

interface SidebarLogoProps {
  collapsed?: boolean
}

export function SidebarLogo({ collapsed = false }: SidebarLogoProps) {
  const { toggleSidebar } = useSidebar()

  return (
    <div className={`flex items-center py-5 ${collapsed ? 'flex-col gap-1 px-2' : 'gap-2 px-4'}`}>
      <Pickaxe className="h-6 w-6 text-primary shrink-0" />
      {!collapsed && (
        <span className="text-lg font-semibold overflow-hidden whitespace-nowrap flex-1">
          Gold Miner
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="transition-all shrink-0"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" data-lucide="chevron-right" />
        ) : (
          <ChevronLeft className="h-4 w-4" data-lucide="chevron-left" />
        )}
      </Button>
    </div>
  )
}
