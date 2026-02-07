'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useFocusArea } from '@/components/providers/FocusAreaProvider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ManageFocusAreasModal } from './ManageFocusAreasModal'

interface FocusAreaDropdownProps {
  onManageClick?: () => void
}

export function FocusAreaDropdown({ onManageClick }: FocusAreaDropdownProps) {
  const { focusAreas, selectedFocusAreaId, setSelectedFocusAreaId } = useFocusArea()
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Find the selected focus area to display its name
  const selectedArea = focusAreas.find((area) => area.id === selectedFocusAreaId)
  const displayName = selectedArea ? selectedArea.name : 'All Areas'

  const handleSelectArea = (id: number | null) => {
    setSelectedFocusAreaId(id)
  }

  const handleManageClick = () => {
    setIsModalOpen(true)
    if (onManageClick) {
      onManageClick()
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full px-4 py-1.5 text-sm bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {displayName}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => handleSelectArea(null)}>
            All
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {focusAreas.map((area) => (
            <DropdownMenuItem
              key={area.id}
              onClick={() => handleSelectArea(area.id)}
            >
              {area.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleManageClick}>
            Manage Focus Areas...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ManageFocusAreasModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  )
}
