---
name: personas-ensemble
title: Personas & Ensemble
status: planning
priority: medium
created: 2026-02-05
updated: 2026-02-05
cycle: experience
story_number: 3
chunks_total: 0
chunks_complete: 0
---

# Story: Personas & Ensemble

## Spark

Create persona agents for each creator once you have enough transcript data. Auto-generate a persona that captures the creator's voice, expertise, and perspective. Enable ensemble chat where you can query multiple personas simultaneously and see their different takes.

Add "who's best" routing — when you ask a question, suggest which creator would be best suited to answer.

> *"As you get more transcripts, like, let's go in, like, just get a bunch of like, get the last 30 videos for each creator. And then once you have that, you can create a persona agent. So you can, like, automate once you've hit a certain threshold of transcripts, it automatically creates a persona agent. So it creates a Nateby Jones agent."*
> *"I also want a I wanna talk to an ensemble. So when we chat with the GoldMiner app and then it will respond to me in different personas. So, like, this is what this guy says. This is what this guy says. His take. This is that take."*
> *"Who would be best to respond to this?"*

## Dependencies

**Blocked by:** Cycle 1 (RAG Foundation) — needs embeddings for persona context
**Blocks:** None

## Acceptance

<!-- Detailed criteria added via plan-chunks -->

## Chunks

<!-- Detailed chunks added via plan-chunks -->

## Notes

- Threshold: ~30 videos before persona creation
- Persona = system prompt + RAG context scoped to creator
- Ensemble UI: side-by-side or tabbed responses
- "Who's best" uses topic matching against creator expertise
- Keep personas agnostic — not hard-coded, learned from content
- Consider persona "voice" extraction from writing style
