---
name: add-transcript-page
title: Add Transcript Page for Non-YouTube Sources
status: active
cycle: polish
story_number: 5
created: 2026-02-09
updated: 2026-02-09
priority: high
chunks_total: 5
chunks_complete: 2
---

# Story: Add Transcript Page for Non-YouTube Sources

## Spark
Allow users to add meeting transcripts, podcast transcripts, and other non-YouTube text to the knowledge bank. A new /add-transcript page with its own clean form feeds into the same processing pipeline (chunking, embedding, search, personas) as YouTube videos.

## Scope

**Included:**
- Schema: make `youtubeId` nullable, add `sourceType` text field (`'youtube' | 'transcript'`)
- New `/add-transcript` route and page component with Title, Source, Transcript, Tags, Notes fields
- API update: accept `sourceType`, make `youtubeId` optional in validation
- Nav link to the new page
- Grow-to-cap textarea (`max-h-[500px] overflow-y-auto`)
- Appropriate visual treatment for transcript entries in knowledge bank and search (no broken thumbnail/YouTube UI)
- Type cascade: update all `youtubeId: string` types to `string | null` across codebase

**Excluded:**
- File upload / drag-and-drop (future enhancement)
- Modifying the existing Add Video page
- PDF or document import
- Renaming existing routes or nav items
- Discovery page changes (stays YouTube-channel-only)

## Preserve
- Existing YouTube add video flow (zero changes to AddVideoPage)
- All downstream processing (chunking, embedding, search, personas, insights)
- Discovery page (YouTube-channel-only, no transcript entries)
- Existing API consumers (backward compatible — `sourceType` defaults to `'youtube'`)

## Hardest Constraint
Making `youtubeId` nullable without breaking existing queries, unique constraints, and any code that assumes `youtubeId` is always present. The type change cascades through ~15 TypeScript interfaces.

## Technical Concerns
- Partial unique index on `youtubeId` WHERE NOT NULL has a known Drizzle bug with `eq()` — must use `sql` template literal syntax
- `drizzle-kit push` may not handle partial unique index — fallback: raw SQL migration
- Existing code references `youtubeId` as non-null in ~15+ type interfaces
- Plain text transcripts (no timestamps) handled by existing parser fallback (single segment at offset 0)

## Recommendations
- Use `sql` template syntax for partial unique index (not `eq()`)
- Reuse `OptionalFields` and `SuccessState` components from add-video
- Run `tsc --noEmit` after schema change to find all type cascade spots
- "Source" field maps to existing `channel` column in DB

## Dependencies
**Blocked by:** None (scroll-cap pattern included directly in Chunk 4)
**Blocks:** None

## Decisions

### Page Structure
**Type:** layout
**Choice:** separate page at /add-transcript, independent from Add Video

### Transcript Input
**Type:** component
**Choice:** inline textarea with grow-to-cap (max-h-[500px] overflow-y-auto)

### Source Type
**Type:** component
**Choice:** text field in schema ('youtube' | 'transcript'), discriminates at API boundary

### Transcript Format
**Type:** component
**Choice:** accept plain text as-is, no timestamp format requirement

### Discovery Scope
**Type:** visibility
**Choice:** minimal — transcript entries appear in Knowledge Bank + search only, not Discovery

## Acceptance
- [ ] Given I navigate to `/add-transcript`, I see a clean form with Title, Source, Transcript, Tags, and Notes fields
- [ ] Given I paste a transcript, the textarea grows naturally for short content but caps at 500px with inner scroll
- [ ] Given I fill in Title, Source, and Transcript (50+ chars), the submit button is enabled
- [ ] Given I submit, the transcript is stored with `sourceType: 'transcript'` and processes through the same chunking/embedding pipeline
- [ ] Given a transcript entry exists, it appears in search and knowledge bank alongside YouTube videos
- [ ] Given a transcript entry, it displays with appropriate visual treatment (no broken thumbnail/YouTube-specific UI)
- [ ] Given an existing YouTube video submission, the flow works identically (backward compatible)
- [ ] Given `tsc --noEmit`, zero type errors across the codebase

## Chunks

### Chunk 1: Schema — Make youtubeId Nullable + Add sourceType

**Goal:** Update database schema to support non-YouTube entries without breaking existing data.

**Files:**
- `src/lib/db/schema.ts` — modify (make `youtubeId` nullable, add `sourceType` text column with default `'youtube'`, update unique constraint to partial index)

**Implementation Details:**
- Change `youtubeId: text('youtube_id').notNull().unique()` → `youtubeId: text('youtube_id')`
- Add `sourceType: text('source_type').notNull().default('youtube')` column
- Add partial unique index: `uniqueIndex('youtube_id_unique').on(videos.youtubeId).where(sql\`${videos.youtubeId} IS NOT NULL\`)`
- Use `sql` template literal (not `eq()`) due to known Drizzle bug with parameterized WHERE clauses
- Run `drizzle-kit push` to apply migration
- Test on dev DB that existing YouTube rows get `sourceType = 'youtube'` default

**What Could Break:**
- Drizzle partial unique index may not work with `drizzle-kit push` — fallback: raw SQL migration
- Existing unique constraint needs to be dropped before adding partial index

**Done When:**
- [ ] `youtubeId` is nullable in schema
- [ ] `sourceType` column exists with default `'youtube'`
- [ ] Partial unique index on `youtubeId` WHERE NOT NULL
- [ ] `drizzle-kit push` succeeds
- [ ] Existing data unaffected (all rows get `sourceType = 'youtube'`)

### Chunk 2: API Update — Accept sourceType, Make youtubeId Optional

**Goal:** Update POST `/api/videos` to accept transcript-type entries.

**Files:**
- `src/app/api/videos/route.ts` — modify (update Zod schema, conditional duplicate check, handle sourceType)
- `src/app/api/videos/__tests__/route.test.ts` — modify (add tests for transcript-type creation, verify YouTube flow unchanged)

**Implementation Details:**
- Update `videoSchema`: `youtubeId` becomes `z.string().min(1).optional()`, add `sourceType: z.enum(['youtube', 'transcript']).default('youtube')`
- When `sourceType === 'youtube'`: require `youtubeId`, run duplicate check (existing behavior)
- When `sourceType === 'transcript'`: skip `youtubeId` requirement and duplicate check
- Insert `sourceType` into DB alongside other fields
- Existing YouTube submissions must work identically (backward compatible)

**What Could Break:**
- Existing API consumers sending without `sourceType` — handled by default `'youtube'`
- Duplicate check logic change could allow YouTube duplicates if not gated properly

**Done When:**
- [ ] Existing YouTube POST still works identically
- [ ] New transcript POST works without `youtubeId`
- [ ] Validation rejects transcript entries without title/channel/transcript
- [ ] Duplicate check only runs for YouTube entries
- [ ] Tests cover both paths

### Chunk 3: Type Cascade — Update youtubeId Types Across Codebase

**Goal:** Update all TypeScript interfaces and code paths that reference `youtubeId` to handle `string | null`.

**Files:**
- `src/lib/search/types.ts` — modify (`youtubeId: string | null`)
- `src/lib/search/aggregate.ts` — modify (`youtubeId: string | null`)
- `src/lib/graph/types.ts` — modify (`youtubeId: string | null`)
- `src/lib/automation/delta.ts` — modify (filter null youtubeIds in query)
- `src/app/videos/[id]/page.tsx` — modify (conditional VideoPlayer render when `youtubeId` is non-null)
- `src/app/discovery/page.tsx` — modify (null guard on youtubeId access)
- Any other files flagged by `tsc --noEmit`

**Implementation Details:**
- Run `tsc --noEmit` to find all type errors from the schema change
- Update type interfaces to `youtubeId: string | null`
- In `delta.ts`: add `.where(isNotNull(videos.youtubeId))` to the feed query
- In video detail page: wrap `VideoPlayer` in `{video.youtubeId && <VideoPlayer ... />}`
- In discovery page: add null guard on `youtubeId` mapping
- Follow the compiler — it catches every spot

**What Could Break:**
- Missing a runtime null access the compiler doesn't catch (unlikely with strict mode)
- Discovery page grouping logic if null youtubeIds leak through

**Done When:**
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Video detail page gracefully handles entries without youtubeId
- [ ] Automation pipeline filters null youtubeIds
- [ ] Discovery page has null guards
- [ ] No runtime errors with transcript entries in knowledge bank

### Chunk 4: Add Transcript Page — Form UI

**Goal:** Create `/add-transcript` route with Title, Source, Transcript, Tags, Notes form.

**Files:**
- `src/app/add-transcript/page.tsx` — create (server component with Suspense, metadata export)
- `src/components/add-transcript/AddTranscriptPage.tsx` — create (main form component)
- `src/components/add-transcript/__tests__/AddTranscriptPage.test.tsx` — create

**Implementation Details:**
- Follow `src/app/add/page.tsx` pattern for route wrapper (Suspense, metadata)
- Form fields: Title (Input, required), Source (Input, required — maps to `channel` column), Transcript (Textarea with `min-h-[300px] max-h-[500px] overflow-y-auto`), character count
- Reuse `OptionalFields` for Tags + Notes
- Reuse `SuccessState` — pass `thumbnail={null}`, check for hardcoded "video" copy
- Submit calls POST `/api/videos` with `sourceType: 'transcript'`, title maps to `title`, source maps to `channel`, no `youtubeId`
- Validation: title required, source required, transcript min 50 chars
- Error handling: same pattern as AddVideoPage (submitError state, alert display)
- `canSubmit = title && source && transcript.length >= 50`

**What Could Break:**
- SuccessState component may have hardcoded "video" copy
- OptionalFields component should work as-is (generic props)

**Done When:**
- [ ] `/add-transcript` renders clean form
- [ ] Title, Source, Transcript fields with validation
- [ ] Textarea has grow-to-cap behavior (max-h-[500px] overflow-y-auto)
- [ ] Character count updates correctly
- [ ] Submit creates entry with `sourceType: 'transcript'`
- [ ] Success state shows after submission
- [ ] Tests cover form rendering, validation, and submission

### Chunk 5: Navigation + Polish

**Goal:** Add nav link, verify transcript entries display properly across the app.

**Files:**
- `src/components/layout/SidebarNav.tsx` — modify (add "Add Transcript" nav item with FileText icon)
- Verify: Knowledge Bank, search results, video detail page all handle transcript entries gracefully

**Implementation Details:**
- Add nav item: `{ href: '/add-transcript', label: 'Add Transcript', icon: FileText }` from lucide-react
- Position after "Add Video" in the nav array
- Manual verification: create a test transcript entry, confirm it shows in Knowledge Bank, appears in search results, detail page renders without VideoPlayer
- Check SuccessState renders correctly with null thumbnail

**What Could Break:**
- Nav ordering or icon import
- Thumbnail fallback in VideoCard (already handles null — verify)

**Done When:**
- [ ] "Add Transcript" appears in sidebar nav
- [ ] Transcript entry visible in Knowledge Bank
- [ ] Search returns transcript entries correctly
- [ ] Video detail page renders transcript entry without YouTube player
- [ ] No broken UI for transcript entries anywhere in the app

## Notes
This transforms Gold Miner from a YouTube-only tool into a broader knowledge extraction platform. The processing pipeline is already source-agnostic — this story adds the ingestion path for non-YouTube content.

Plain text transcripts (no timestamps) are accepted as-is — the parser falls back to a single segment at offset 0, and the chunker splits by character count.

"Source" field on the form maps to the existing `channel` column in the DB. This means transcript sources appear alongside YouTube channels in stats — acceptable for now.
