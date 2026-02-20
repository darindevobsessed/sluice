import { StatsHeaderSkeleton } from '@/components/videos/StatsHeader'
import { PersonaStatusSkeleton } from '@/components/personas/PersonaStatus'
import { VideoCardSkeleton } from '@/components/videos/VideoCard'

export function KnowledgeBankPageSkeleton() {
  return (
    <div data-testid="knowledge-bank-skeleton" className="p-4 sm:p-6">
      {/* Stats Header skeleton — already includes mb-6 */}
      <StatsHeaderSkeleton />

      {/* Persona Status skeleton */}
      <div className="mb-4">
        <PersonaStatusSkeleton />
      </div>

      {/* Search bar skeleton */}
      <div className="mb-8">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
      </div>

      {/* Video grid skeleton — matches VideoGrid grid classes */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
