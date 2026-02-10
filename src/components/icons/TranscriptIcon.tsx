import { cn } from '@/lib/utils'

interface TranscriptIconProps {
  className?: string
}

/**
 * Document-with-lines SVG icon for transcript entries.
 * Displays wherever thumbnails appear to give transcripts visual identity.
 */
export function TranscriptIcon({ className }: TranscriptIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-muted-foreground', className)}
      aria-hidden="true"
    >
      {/* Document outline */}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      {/* Text lines */}
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}
