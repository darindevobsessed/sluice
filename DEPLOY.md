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

---

## 4. Deploy

- [ ] In the Vercel dashboard, trigger the first deployment:
  - If you skipped the initial deploy in Section 1: click **Deploy** now
  - If it already deployed (with missing env vars): go to **Deployments**, click the latest, and **Redeploy** (check "Use existing Build Cache" = OFF for a clean build)
- [ ] Watch the build logs for:
  - `npm install` completing without errors
  - `next build` completing successfully
  - No warnings about missing environment variables in build output
- [ ] Verify the deployment URL works (e.g., `https://gold-miner-xxx.vercel.app`)
- [ ] Check the Function logs (Vercel dashboard > Logs) for startup -- you should NOT see:
  - `Warning: ANTHROPIC_API_KEY not set` (means env var is missing)
  - `Warning: CRON_SECRET not set` (means cron endpoints are unsecured)

> **Troubleshooting: Build fails with ONNX errors**
> The embedding pipeline uses `@huggingface/transformers` which downloads the model at runtime to `/tmp/.cache`. If the build itself tries to import this during static page generation, it may fail. All embedding-using routes are API routes (not pages), so this should not happen. If it does, check that no page component imports from `@/lib/embeddings/` directly.

> **Troubleshooting: Function timeout on first request**
> The first request to an embedding route (search, embed) downloads the ~23MB all-MiniLM-L6-v2 model to `/tmp/.cache`. This cold start can take 10-15 seconds. Subsequent requests reuse the cached model (within the same serverless function instance). This is normal.

---

## 5. Domain Configuration (Optional)

Skip this section if the default `*.vercel.app` domain is sufficient.

- [ ] Go to Vercel dashboard > **Settings > Domains**
- [ ] Add your custom domain (e.g., `goldminer.yourdomain.com`)
- [ ] Configure DNS at your domain registrar:
  - **CNAME record:** `goldminer` -> `cname.vercel-dns.com`
  - OR for apex domain: **A record** -> `76.76.21.21`
- [ ] Wait for DNS propagation (usually 1-5 minutes, can take up to 48 hours)
- [ ] Vercel auto-provisions SSL certificate via Let's Encrypt
- [ ] Verify HTTPS works: `https://goldminer.yourdomain.com`

---

## 6. Verify Cron Jobs

Gold Miner uses two Vercel Cron Jobs defined in `vercel.json`:

| Cron Job | Schedule | Path | Purpose |
|----------|----------|------|---------|
| Check Feeds | Every 12 hours (`0 */12 * * *`) | `/api/cron/check-feeds` | Polls RSS feeds for new videos from followed channels |
| Process Jobs | Every 5 minutes (`*/5 * * * *`) | `/api/cron/process-jobs` | Processes queued jobs (transcript fetch, embedding generation) |

- [ ] Go to Vercel dashboard > **Settings > Cron Jobs**
- [ ] Verify both cron jobs appear with correct schedules
- [ ] Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` header to cron endpoints
- [ ] To manually trigger a cron job for testing:
  ```bash
  # Check feeds
  curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.vercel.app/api/cron/check-feeds

  # Process jobs
  curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.vercel.app/api/cron/process-jobs
  ```
- [ ] Expected responses:
  - `check-feeds`: `{"checked": 0, "queued": 0}` (0 channels followed initially)
  - `process-jobs`: `{"processed": 0, "failed": 0}` (no jobs queued initially)

> **Note:** Vercel Cron Jobs require the Pro plan. On Hobby, crons run at most once per day. On Pro, the minimum interval is 1 minute.
