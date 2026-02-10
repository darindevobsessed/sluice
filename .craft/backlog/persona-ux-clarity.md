---
name: persona-ux-clarity
title: Persona UX clarity and discoverability improvements
status: planning
created: 2026-02-10
updated: 2026-02-10
priority: medium
chunks_total: 0
chunks_complete: 0
---

# Story: Persona UX clarity and discoverability improvements

## Spark
Users don't understand how personas work in the app. The feature exists and works well technically, but lacks discoverability and clear usage guidance. Users need to understand: what personas are, how to interact with them, which ones exist, and what kinds of questions they can ask.

## Scope

**Included:**
- Persona gallery/management page showing all created personas with their channel info
- Interactive help text near search explaining persona question detection
- Example question suggestions that users can click to try
- Visual indicators when persona mode activates (question detection feedback)
- Persona metadata display (creation date, source channel, video count)
- Quick actions (view persona details, ask targeted questions)

**Excluded:**
- Persona editing/customization (personas are auto-generated from channel content)
- Advanced persona management (delete, regenerate) - keep it simple
- Persona analytics/usage stats
- Multi-persona conversations/threading

## Preserve
- Current question detection logic (3+ words, question patterns)
- Existing PersonaPanel and PersonaColumn components
- Current ensemble API and streaming responses
- Persona suggestion banner functionality

## Hardest Constraint
Balancing discoverability without overwhelming the main Knowledge Bank interface. The persona feature should be discoverable but not dominate the primary video search/browse experience. Need to guide users naturally into persona usage.

## Technical Concerns
- GET /api/personas endpoint exists but need to verify it returns channel metadata
- Need to design persona gallery layout that works with variable persona counts (0-20+)
- Question suggestions should be contextual to available personas/channels
- Help text positioning needs to work on mobile

## Recommendations
- Add a "Meet Your Personas" section accessible from main nav or prominent link
- Use progressive disclosure: basic help text + expandable detailed explanation
- Generate question examples dynamically based on actual persona channels
- Use gentle visual feedback when question detection activates (subtle highlight, icon change)

## Dependencies
**Blocked by:** None
**Blocks:** None

## Acceptance
- [ ] Given a user visits the persona gallery, when they see the page, then all created personas are listed with channel names and creation dates
- [ ] Given a user on the main search page, when they see the search bar, then there is clear but unobtrusive help text explaining persona questions
- [ ] Given a user types a 3+ word question, when persona detection activates, then there is visual feedback showing persona mode is engaged
- [ ] Given a user wants example questions, when they look for suggestions, then 3-4 relevant example questions are provided based on their actual personas
- [ ] Given a user clicks an example question, when they do, then the search bar populates and persona query executes
- [ ] Given a user browses personas, when they want to ask a targeted question to one, then there is a clear way to do so
- [ ] Given a user has no personas, when they visit the gallery, then helpful guidance explains how to create personas

## Notes
Focus on education and discoverability rather than advanced features. The goal is to unlock the existing powerful persona functionality for users who don't realize it exists or how to use it effectively.