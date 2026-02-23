---
description: Ingest one or more YouTube videos into the Sluice knowledge base
arguments:
  - name: urls
    description: One or more YouTube video URLs (space-separated)
    required: true
---

Ingest the YouTube video(s) at `$ARGUMENTS.urls` into the Sluice knowledge base. The dev server must be running on localhost:3001.

Process each URL one at a time. For each video, follow these steps using bash (curl).

## Step 1: Extract the video ID

Parse the YouTube video ID from the URL. Handle these formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID&list=...` (ignore extra params)

## Step 2: Fetch metadata

Use the YouTube oEmbed API directly:

```
curl -s "https://www.youtube.com/oembed?url=https://youtube.com/watch?v=VIDEO_ID&format=json"
```

Extract `title`, `author_name`, and `thumbnail_url` from the response.

If this fails, report it and skip to the next URL.

## Step 3: Fetch transcript

Call the project API:

```
curl -s -X POST http://localhost:3001/api/youtube/transcript \
  -H "Content-Type: application/json" \
  -d '{"videoId": "VIDEO_ID"}'
```

Extract the `transcript` field from the response. If `success` is false, report it and skip to the next URL.

## Step 4: Auto-generate tags and notes

Based on the video title, channel name, and the first ~2000 characters of the transcript:

- **Tags**: Generate 3-5 relevant comma-separated tags (e.g., "ai, claude, developer-tools, automation"). Keep them short, lowercase, and relevant to the content.
- **Notes**: Write a 1-2 sentence summary of what the video covers.

## Step 5: Save to knowledge bank

Call the project API with all the data. IMPORTANT: The transcript can be very long — write the JSON payload to a temp file and use `curl --data @file` to avoid shell escaping issues.

```
curl -s -X POST http://localhost:3001/api/videos \
  -H "Content-Type: application/json" \
  --data @/tmp/gm-ingest-payload.json
```

The JSON payload should include: `youtubeId`, `title`, `channel`, `thumbnail`, `transcript`, `tags` (as an array), and `notes`.

- If the response status is 409, note that this video already exists and continue to the next.
- If the response status is 201, note success.

Clean up any temp files after each video.

## Output

After processing all URLs, show a summary table:

| # | Title | Channel | Status |
|---|-------|---------|--------|

Include for each: video title (truncated to ~50 chars), channel name, and status (saved / already exists / failed + reason).

If any videos were saved, remind the user that embeddings are being generated in the background.
