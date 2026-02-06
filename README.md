This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) - Required for running the Postgres database with pgvector extension

## Getting Started

First, start the database:

```bash
docker compose up -d
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## MCP Integration

Gold Miner exposes a Model Context Protocol (MCP) server, allowing external AI tools to query the knowledge base.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_rag` | Search the knowledge base | `topic` (required), `creator` (optional), `limit` (optional) |
| `get_list_of_creators` | List all channels with video counts | none |

### Claude Desktop Setup

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "gold-miner": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp/mcp"]
    }
  }
}
```

### Authentication

Auth is disabled by default for local development. To enable:

```bash
MCP_AUTH_ENABLED=true
MCP_AUTH_TOKEN=your-secret-token
```

When auth is enabled, include the token in requests:
```
Authorization: Bearer your-secret-token
```
