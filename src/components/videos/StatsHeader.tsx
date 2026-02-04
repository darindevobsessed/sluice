import { cn } from '@/lib/utils';

interface StatsHeaderProps {
  count: number;
  totalHours: number;
  channels: number;
  className?: string;
}

interface StatCardProps {
  value: number | string;
  label: string;
}

function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-surface-secondary p-4 text-center">
      <span className="text-3xl font-bold text-foreground">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function StatsHeader({ count, totalHours, channels, className }: StatsHeaderProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-3', className)}>
      <StatCard
        value={count}
        label={count === 1 ? 'video' : 'videos'}
      />
      <StatCard
        value={totalHours}
        label="hrs of content"
      />
      <StatCard
        value={channels}
        label={channels === 1 ? 'channel' : 'channels'}
      />
    </div>
  );
}

export function StatsHeaderSkeleton() {
  return (
    <div data-testid="stats-header-skeleton" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col items-center rounded-lg bg-muted/50 p-4">
          <div className="mb-2 h-9 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
