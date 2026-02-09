'use client'

import { useState, useMemo, useRef } from 'react'
import { DiscoveryVideoCard, DiscoveryVideoCardSkeleton, type DiscoveryVideo } from './DiscoveryVideoCard'
import { Pagination } from './Pagination'

interface DiscoveryVideoGridProps {
  videos: DiscoveryVideo[]
  isLoading?: boolean
  focusAreaMap?: Record<string, { id: number; name: string; color: string }[]>
}

const VIDEOS_PER_PAGE = 24

export function DiscoveryVideoGrid({ videos, isLoading = false, focusAreaMap }: DiscoveryVideoGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Sort videos by publishedAt descending (newest first)
  const sortedVideos = useMemo(() => {
    return [...videos].sort((a, b) => {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
  }, [videos])

  // Create a stable key from the video IDs to detect when the video list changes
  const videosKey = useMemo(() => {
    return videos.map((v) => v.youtubeId).join(',')
  }, [videos])

  // State includes both current page and the videos key it's associated with
  // This allows us to reset page to 1 when videos change
  const [pageState, setPageState] = useState<{ page: number; videosKey: string }>({
    page: 1,
    videosKey
  })

  // If videos changed, reset to page 1
  const currentPage = pageState.videosKey === videosKey ? pageState.page : 1

  // Calculate pagination
  const totalPages = Math.ceil(sortedVideos.length / VIDEOS_PER_PAGE)
  const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE
  const endIndex = startIndex + VIDEOS_PER_PAGE
  const currentVideos = sortedVideos.slice(startIndex, endIndex)

  // Scroll to top of grid on page change
  const handlePageChange = (page: number) => {
    setPageState({ page, videosKey })

    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Loading state: 24 skeletons in grid
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: VIDEOS_PER_PAGE }).map((_, i) => (
          <DiscoveryVideoCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  // Empty state: no videos
  if (sortedVideos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Follow channels to discover videos</p>
      </div>
    )
  }

  return (
    <div ref={gridRef}>
      {/* Video Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {currentVideos.map((video) => {
          const focusAreas = focusAreaMap?.[video.youtubeId]

          return (
            <DiscoveryVideoCard
              key={video.youtubeId}
              video={video}
              focusAreas={focusAreas}
            />
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  )
}
