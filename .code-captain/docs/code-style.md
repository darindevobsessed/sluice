# Code Style Guide

## File Organization

### Directory Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── videos/        # Resource-based API structure
│   │       └── [id]/      # Dynamic routes
│   ├── videos/[id]/       # Dynamic page routes
│   └── page.tsx           # Page components
├── components/            # React components
│   ├── ui/               # Reusable UI primitives (button, card, etc.)
│   ├── layout/           # Layout components (Sidebar, MainContent)
│   ├── videos/           # Video-related feature components
│   ├── insights/         # Insights-related feature components
│   ├── add-video/        # Add video workflow components
│   ├── settings/         # Settings components
│   └── providers/        # React context providers
├── lib/                   # Shared utilities and core logic
│   ├── db/               # Database schema, queries, migrations
│   ├── youtube/          # YouTube API integration
│   ├── transcript/       # Transcript parsing utilities
│   ├── claude/           # Claude AI integration
│   │   └── prompts/      # Extraction prompts and types
│   └── agent/            # Agent connection utilities
├── hooks/                 # Custom React hooks
└── agent/                 # Background agent server (Node.js)
```

### Test File Placement
- Tests live alongside source files in `__tests__/` directories
- Pattern: `src/components/videos/__tests__/VideoCard.test.tsx`
- Test files use `.test.ts` or `.test.tsx` extension

## Naming Conventions

### Files
- **Components**: PascalCase (`VideoCard.tsx`, `InsightsPanel.tsx`)
- **Hooks**: camelCase with `use` prefix (`useExtraction.ts`)
- **Utilities**: camelCase (`parse.ts`, `utils.ts`)
- **Types**: camelCase (`types.ts`)
- **API Routes**: `route.ts` (Next.js convention)

### Variables & Functions
- **Components**: PascalCase (`function VideoCard()`)
- **Functions**: camelCase (`formatDuration()`, `parsePartialJSON()`)
- **Constants**: SCREAMING_SNAKE_CASE (`const TOKEN_FILE = '.agent-token'`)
- **Interfaces/Types**: PascalCase (`interface ExtractionResult`)
- **Props interfaces**: ComponentName + `Props` (`interface VideoCardProps`)

### CSS Classes
- Tailwind utility classes with `cn()` helper for conditional merging
- Custom CSS variables in `globals.css` for theming

## Code Patterns

### Component Structure
```tsx
'use client';  // Client components marked explicitly

import { ... } from 'external';  // External imports first
import { ... } from '@/lib/...'; // Internal imports second
import type { ... } from '...';  // Type imports last

interface ComponentProps {
  required: string;
  optional?: number;
  className?: string;  // Common pattern for styling override
}

/**
 * JSDoc comment for component purpose
 */
export function Component({ required, optional, className }: ComponentProps) {
  // Hooks first
  const [state, setState] = useState();

  // Effects next
  useEffect(() => { ... }, [deps]);

  // Handlers/callbacks
  const handleClick = () => { ... };

  // Render
  return (
    <div className={cn('base-classes', className)}>
      ...
    </div>
  );
}
```

### API Route Pattern
```tsx
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validation and business logic

  return NextResponse.json(data);
}
```

### Custom Hook Pattern
```tsx
interface UseFeatureOptions {
  // Input options
}

interface UseFeatureReturn {
  // Return shape documented
}

export function useFeature(options: UseFeatureOptions): UseFeatureReturn {
  const [state, setState] = useState(initialState);

  // useCallback for stable references
  const action = useCallback(() => { ... }, [deps]);

  return { state, action };
}
```

### Database Query Pattern
```tsx
// Schema in src/lib/db/schema.ts
export const videos = sqliteTable('videos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // columns...
});

// Type exports
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

// Query functions in feature-specific files
export async function getVideoById(id: number): Promise<Video | null> {
  return db.query.videos.findFirst({ where: eq(videos.id, id) });
}
```

### Streaming/Agent Pattern
```tsx
agent.generateInsight(
  { prompt, systemPrompt },
  {
    onStart: () => { /* reset state */ },
    onText: (text) => { /* accumulate, parse partial */ },
    onDone: async (fullContent) => { /* finalize, persist */ },
    onError: (error) => { /* handle error */ },
    onCancel: () => { /* cleanup */ },
  }
);
```

## Testing Patterns

### Component Tests
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentName } from '../ComponentName';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName prop="value" />);
    expect(screen.getByText('expected')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<ComponentName />);
    await user.click(screen.getByRole('button'));
    // assertions
  });
});
```

### Unit Tests
```tsx
import { functionName } from '../module';

describe('functionName', () => {
  it('handles normal case', () => {
    expect(functionName(input)).toBe(expected);
  });

  it('handles edge case', () => {
    expect(functionName(null)).toBe(fallback);
  });
});
```

## Documentation Style

### JSDoc Comments
- Components get a one-line description
- Complex functions get param/return documentation
- Types are self-documenting through TypeScript

```tsx
/**
 * Format duration in seconds to display string (H:MM:SS or M:SS)
 */
function formatDuration(seconds: number | null): string | null { ... }

/**
 * Main insights panel with empty state, streaming state, and complete state.
 * Shows sections for summary, insights, action items, and Claude Code plugins.
 */
export function InsightsPanel({ ... }: InsightsPanelProps) { ... }
```

## Import Aliases

- `@/*` maps to `./src/*`
- Prefer alias imports for cross-directory references:
  ```tsx
  import { db } from '@/lib/db';
  import { VideoCard } from '@/components/videos/VideoCard';
  ```

## TypeScript Configuration

- **Strict mode**: `strict: true`
- **No unchecked indexed access**: `noUncheckedIndexedAccess: true`
- **No implicit returns**: `noImplicitReturns: true`
- Target: ES2017 for broad compatibility
