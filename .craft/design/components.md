# Component Patterns

## Planned Components

### Core UI (from shadcn/ui)
- Button (primary, secondary, ghost, destructive)
- Card
- Input
- Dialog/Modal
- Toast/Notification
- Dropdown Menu
- Tabs
- Badge

### Custom Components

#### VideoCard
Display a YouTube video in the knowledge bank.
- Thumbnail with duration overlay
- Title (truncated)
- Channel name
- Processing status indicator
- Actions (view, delete)

#### TranscriptViewer
Display video transcript with timestamps.
- Timestamp markers (clickable)
- Search highlighting
- Copy functionality
- Collapsible sections

#### KnowledgeSearch
Semantic search across the knowledge bank.
- Search input with instant feedback
- Filter by source, date, topic
- Results with relevance scoring
- Preview snippets

#### PluginSuggestionCard
Display a generated Claude Code plugin suggestion.
- Plugin type badge (skill, command, agent, rule)
- Title and description
- Source reference
- Actions (copy, refine, dismiss)

#### ProcessingQueue
Show videos being processed.
- Video thumbnail/title
- Progress bar
- Status (queued, transcribing, extracting, complete)
- Error handling with retry

## Component Guidelines

### Props
- Use TypeScript interfaces
- Prefer composition over configuration
- Default to uncontrolled, support controlled

### Styling
- Use Tailwind utilities via `cn()` helper
- Support className prop for overrides
- Use CSS variables for theme values

### Accessibility
- Proper ARIA labels
- Keyboard navigation
- Focus management
- Screen reader announcements
