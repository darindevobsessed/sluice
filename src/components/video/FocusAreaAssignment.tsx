'use client'

import { useEffect, useState, useCallback } from 'react'
import { useFocusArea } from '@/components/providers/FocusAreaProvider'
import type { FocusArea } from '@/lib/db/schema'

interface FocusAreaAssignmentProps {
  videoId: number
}

export function FocusAreaAssignment({ videoId }: FocusAreaAssignmentProps) {
  const { focusAreas } = useFocusArea()
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<number | null>(null)

  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetch(`/api/videos/${videoId}/focus-areas`)
      if (response.ok) {
        const data = await response.json()
        const ids = new Set<number>((data.focusAreas || []).map((fa: FocusArea) => fa.id))
        setAssignedIds(ids)
      }
    } catch (error) {
      console.error('Failed to fetch video focus areas:', error)
    } finally {
      setIsLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  const toggleFocusArea = async (focusAreaId: number) => {
    const isAssigned = assignedIds.has(focusAreaId)
    setPendingId(focusAreaId)

    try {
      if (isAssigned) {
        const response = await fetch(
          `/api/videos/${videoId}/focus-areas?focusAreaId=${focusAreaId}`,
          { method: 'DELETE' }
        )
        if (response.ok) {
          setAssignedIds(prev => {
            const next = new Set(prev)
            next.delete(focusAreaId)
            return next
          })
        }
      } else {
        const response = await fetch(`/api/videos/${videoId}/focus-areas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ focusAreaId }),
        })
        if (response.ok || response.status === 201) {
          setAssignedIds(prev => new Set(prev).add(focusAreaId))
        }
      }
    } catch (error) {
      console.error('Failed to toggle focus area:', error)
    } finally {
      setPendingId(null)
    }
  }

  if (focusAreas.length === 0) {
    return null
  }

  return (
    <div className="mb-6 rounded-lg border bg-card/50 p-4">
      <h3 className="mb-3 text-sm font-semibold">Focus Areas</h3>
      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          <>
            <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-8 w-16 animate-pulse rounded-full bg-muted" />
          </>
        ) : (
          focusAreas.map((area) => {
            const isAssigned = assignedIds.has(area.id)
            const isPending = pendingId === area.id
            return (
              <button
                key={area.id}
                onClick={() => toggleFocusArea(area.id)}
                disabled={isPending}
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm transition-all ${
                  isAssigned
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                } ${isPending ? 'opacity-50' : ''}`}
              >
                {area.name}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
