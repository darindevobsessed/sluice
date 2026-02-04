import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Mountain, Sparkles } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Icon illustration */}
      <div className="relative mb-6">
        <Mountain className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />
        <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-primary" />
      </div>

      {/* Heading */}
      <h2 className="mb-3 text-2xl font-semibold">
        Start building your knowledge vault
      </h2>

      {/* Tagline */}
      <p className="mb-8 text-muted-foreground">
        Save videos • Search transcripts • Extract insights
      </p>

      {/* CTA Button */}
      <Button asChild size="lg" className="rounded-full px-8">
        <Link href="/add">Add Your First Video</Link>
      </Button>
    </div>
  );
}
