# Gold Miner

A knowledge extraction platform that transforms YouTube content into a searchable knowledge bank, with AI-powered suggestions for Claude Code plugins (skills, commands, agents, and rules).

## Project Overview

**Purpose**: Extract valuable knowledge from YouTube videos and use it to generate Claude Code customization ideas.

### Core Features

1. **YouTube Ingestion** - Accept YouTube links and process videos
2. **Transcription** - Convert video audio to text transcripts
3. **Knowledge Bank** - Store and organize extracted knowledge
4. **Search & Discovery** - Find relevant topics across the knowledge base
5. **Claude Plugin Generator** - Suggest skills, commands, agents, and rules inspired by the knowledge

## Tech Stack

*(To be determined based on implementation choices)*

Potential options:
- **Frontend**: React/Vite, Next.js, or similar
- **Backend**: Node.js, Python (FastAPI), or similar
- **Database**: PostgreSQL, SQLite, or vector DB for semantic search
- **Transcription**: Whisper API, AssemblyAI, or similar
- **AI/Embeddings**: Claude API, OpenAI embeddings

## Project Structure

```
gold-miner/
├── CLAUDE.md           # This file - project guidance
├── src/                # Source code
├── docs/               # Documentation
└── ...
```

## Development Guidelines

### Code Style
- Use TypeScript for type safety (if JS-based)
- Write clear, self-documenting code
- Keep functions focused and single-purpose

### Testing
- Write tests for critical functionality
- Test transcription accuracy where possible
- Validate knowledge extraction quality

### Commands
*(Add build, test, and run commands as the project develops)*

## Knowledge Bank Schema

The knowledge bank should capture:
- **Source**: YouTube URL, title, channel, date
- **Transcript**: Full text with timestamps
- **Topics**: Extracted key topics/themes
- **Insights**: Notable quotes, techniques, patterns
- **Plugin Ideas**: Generated suggestions for Claude customizations

## Claude Plugin Types to Generate

1. **Skills** - Specialized capabilities for specific tasks
2. **Commands** - Slash commands for common workflows
3. **Agents** - Autonomous task handlers
4. **Rules** - Guidelines and constraints for Claude behavior

## Notes

- Respect YouTube ToS and copyright considerations
- Consider rate limiting for API calls
- Cache transcripts to avoid re-processing
