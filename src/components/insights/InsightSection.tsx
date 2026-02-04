'use client';

import type { LucideIcon } from 'lucide-react';
import { Check, Loader2 } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { cn } from '@/lib/utils';

interface InsightSectionProps {
  title: string;
  icon: LucideIcon;
  status: 'pending' | 'working' | 'done';
  content: string;
  className?: string;
}

/**
 * Skeleton loader for empty content areas
 */
function SkeletonLoader() {
  return (
    <div className="space-y-3 animate-pulse" data-testid="skeleton-loader">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-4 bg-muted rounded w-2/3" />
    </div>
  );
}

/**
 * Individual insight section with status indicator and content.
 * Shows skeleton loader when pending/working with no content,
 * cursor animation when working with content, and copy button when done.
 */
export function InsightSection({
  title,
  icon: Icon,
  status,
  content,
  className,
}: InsightSectionProps) {
  const hasContent = content && content.trim().length > 0;

  return (
    <div className={cn(
      'rounded-lg border bg-card p-6 transition-all duration-300',
      status === 'working' && 'border-blue-500/50 shadow-sm shadow-blue-500/10',
      className
    )}>
      {/* Header with title, icon, and status */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className={cn(
            'h-5 w-5',
            status === 'working' ? 'text-blue-500' : 'text-muted-foreground'
          )} />
          <h3 className="text-lg font-semibold">{title}</h3>
          {status === 'working' && (
            <span className="text-xs text-blue-500 font-medium">Generating...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          {status === 'pending' && (
            <div
              className="h-3 w-3 rounded-full border-2 border-muted-foreground/50"
              data-testid="status-indicator-pending"
              aria-label="Pending"
            />
          )}
          {status === 'working' && (
            <Loader2
              className="h-5 w-5 animate-spin text-blue-500"
              data-testid="status-indicator-working"
              aria-label="Working"
            />
          )}
          {status === 'done' && (
            <Check
              className="h-5 w-5 text-green-600"
              data-testid="status-indicator-done"
              aria-label="Done"
            />
          )}
          {/* Copy button - only shown when done */}
          {status === 'done' && hasContent && <CopyButton text={content} />}
        </div>
      </div>

      {/* Content area */}
      <div className="prose prose-sm max-w-none dark:prose-invert">
        {/* Show skeleton when working/pending with no content */}
        {!hasContent && (status === 'working' || status === 'pending') && (
          <SkeletonLoader />
        )}

        {/* Show content when available */}
        {hasContent && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {content}
            {/* Cursor animation when working */}
            {status === 'working' && (
              <span
                className="ml-1 inline-block h-4 w-2 animate-pulse bg-blue-500"
                data-testid="cursor-animation"
              />
            )}
          </div>
        )}

        {/* Empty state for done with no content */}
        {!hasContent && status === 'done' && (
          <p className="text-sm text-muted-foreground italic">No content extracted for this section.</p>
        )}
      </div>
    </div>
  );
}
