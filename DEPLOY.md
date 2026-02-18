# Gold Miner -- Production Deployment Guide

A step-by-step checklist for deploying Gold Miner to Vercel with a Neon PostgreSQL database.

---

## Prerequisites

- [ ] GitHub repository accessible (DevObsessed org or personal)
- [ ] Vercel account with **Pro plan** (required for 60-second function timeout on heavy routes)
- [ ] Neon account at [neon.tech](https://neon.tech) (free tier works for single-user)
- [ ] Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
- [ ] Domain name (optional -- Vercel provides a `.vercel.app` subdomain by default)

### Why Vercel Pro?

Gold Miner has 9 API routes that export `maxDuration = 60` for long-running operations:
- `/api/search` -- hybrid RAG search with embedding generation
- `/api/agent/stream` -- Claude insight streaming via SSE
- `/api/cron/check-feeds` -- RSS feed checking across channels
- `/api/cron/process-jobs` -- job queue processing
- `/api/personas` -- persona generation with Claude
- `/api/personas/[id]/query` -- persona chat
- `/api/personas/ensemble` -- multi-persona streaming
- `/api/videos/[id]/embed` -- embedding pipeline
- `/api/graph/backfill` -- graph relationship building
- `/api/mcp/[transport]` -- MCP tool execution

Vercel Hobby plan limits functions to 10 seconds. These routes will timeout on Hobby.

---

## 1. Create Vercel Project

- [ ] Go to [vercel.com/new](https://vercel.com/new)
- [ ] Import the Gold Miner repository from GitHub
- [ ] Framework Preset: **Next.js** (auto-detected)
- [ ] Root Directory: `.` (default -- Gold Miner is not in a monorepo subdirectory)
- [ ] Build Command: `npm run build` (default)
- [ ] Output Directory: `.next` (default)
- [ ] Install Command: `npm install` (default)
- [ ] **Do NOT deploy yet** -- configure environment variables first (Section 3)

---

## 2. Provision Neon PostgreSQL Database

### Create Database

- [ ] Go to [console.neon.tech](https://console.neon.tech)
- [ ] Create a new project (name: `gold-miner` or similar)
- [ ] Region: choose closest to your Vercel deployment region (default: `us-east-1`)
- [ ] Copy the connection string -- it looks like:
  ```
  postgresql://neondb_owner:PASSWORD@ep-XXXXX.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```

### Enable pgvector Extension

Gold Miner uses pgvector for 384-dimensional vector embeddings (all-MiniLM-L6-v2 model).

- [ ] Open the Neon SQL Editor (or connect via `psql`)
- [ ] Run:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- [ ] Verify it installed:
  ```sql
  SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
  ```
  Expected: one row with `extname = vector`

### Push Schema

- [ ] From your local machine, set `DATABASE_URL` to the Neon connection string:
  ```bash
  DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-XXXXX.us-east-2.aws.neon.tech/neondb?sslmode=require" npm run db:push
  ```
- [ ] Drizzle will create all 11 tables: `videos`, `channels`, `insights`, `settings`, `chunks`, `relationships`, `temporal_metadata`, `jobs`, `focus_areas`, `video_focus_areas`, `personas`
- [ ] Verify with Drizzle Studio or SQL Editor:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
  ```

> **Troubleshooting:** If `db:push` fails with SSL errors, ensure your connection string includes `?sslmode=require`. The Gold Miner DB module auto-detects Neon URLs (checks for `neon.tech` in the connection string) and configures SSL + reduced pool size (3 connections instead of 10).

---

## 3. Configure Environment Variables

In the Vercel dashboard, go to **Settings > Environment Variables** for your project. Add each variable for the **Production** environment.

### Required

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...@...neon.tech/...?sslmode=require` | Your Neon connection string from Section 2. Pool auto-sizes to 3 connections for Neon. |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API key for insights, personas, ensemble queries. Get at [console.anthropic.com](https://console.anthropic.com). |
| `AGENT_AUTH_TOKEN` | Any secure random string (e.g., `openssl rand -hex 32`) | Authenticates SSE agent transport in production. When this is set, the `/api/agent/token` endpoint returns `transport: 'sse'` instead of `transport: 'websocket'`. |
| `CRON_SECRET` | Any secure random string (e.g., `openssl rand -hex 32`) | Secures `/api/cron/*` endpoints. Vercel sends this as `Authorization: Bearer <token>` header. |

### Optional

| Variable | Value | Notes |
|----------|-------|-------|
| `MCP_AUTH_ENABLED` | `true` | Enable MCP endpoint authentication. Default: `false` (open access). |
| `MCP_AUTH_TOKEN` | Any secure random string | Required when `MCP_AUTH_ENABLED=true`. Clients send as `Authorization: Bearer <token>`. |
| `NEXT_PUBLIC_AGENT_PORT` | `9334` | Only relevant for local dev (WebSocket agent). Not used in production (SSE transport). Can be omitted. |

> **Note:** Do NOT set `PORT` or `AGENT_PORT` -- these are local dev settings. Vercel manages ports automatically.

> **Security:** Generate tokens with `openssl rand -hex 32` for cryptographic randomness. Do not reuse tokens across variables.
