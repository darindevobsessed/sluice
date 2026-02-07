'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { useFocusArea } from '@/components/providers/FocusAreaProvider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ManageFocusAreasModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageFocusAreasModal({ open, onOpenChange }: ManageFocusAreasModalProps) {
  const { focusAreas, selectedFocusAreaId, setSelectedFocusAreaId, refetch } = useFocusArea()
  const [newAreaName, setNewAreaName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    const trimmedName = newAreaName.trim()
    if (!trimmedName) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/focus-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      })

      if (response.ok) {
        setNewAreaName('')
        await refetch()
      }
    } catch (error) {
      console.error('Failed to create focus area:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartEdit = (id: number, name: string) => {
    setEditingId(id)
    setEditingName(name)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleSaveEdit = async (id: number) => {
    const trimmedName = editingName.trim()
    if (!trimmedName) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/focus-areas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      })

      if (response.ok) {
        setEditingId(null)
        setEditingName('')
        await refetch()
      }
    } catch (error) {
      console.error('Failed to update focus area:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    const confirmed = window.confirm(`Delete "${name}"?`)
    if (!confirmed) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/focus-areas/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // If deleting the currently selected area, reset to "All"
        if (selectedFocusAreaId === id) {
          setSelectedFocusAreaId(null)
        }
        await refetch()
      }
    } catch (error) {
      console.error('Failed to delete focus area:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Focus Areas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {focusAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No focus areas yet. Create your first one below.
            </p>
          ) : (
            <div className="space-y-2">
              {focusAreas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                >
                  {editingId === area.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border rounded outline-none focus:ring-2 focus:ring-ring"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSaveEdit(area.id)}
                        disabled={isLoading}
                        aria-label="Save"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        disabled={isLoading}
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">{area.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartEdit(area.id, area.name)}
                        disabled={isLoading}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(area.id, area.name)}
                        disabled={isLoading}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-4 border-t">
          <input
            type="text"
            value={newAreaName}
            onChange={(e) => setNewAreaName(e.target.value)}
            placeholder="New focus area name"
            className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-ring"
            disabled={isLoading}
          />
          <Button onClick={handleCreate} disabled={isLoading}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
