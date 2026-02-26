import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getExtractionForVideo, upsertExtraction } from '@/lib/db/insights'
import { startApiTimer } from '@/lib/api-timing'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

const extractionSchema = z.object({
  extraction: z.object({
    contentType: z.enum(['dev', 'meeting', 'educational', 'thought-leadership', 'general']),
    summary: z.object({
      tldr: z.string(),
      overview: z.string(),
      keyPoints: z.array(z.string()).default([]),
    }),
    insights: z.array(z.object({
      title: z.string(),
      timestamp: z.string(),
      explanation: z.string(),
      actionable: z.string(),
    })).default([]),
    actionItems: z.object({
      immediate: z.array(z.string()).default([]),
      shortTerm: z.array(z.string()).default([]),
      longTerm: z.array(z.string()).default([]),
      resources: z.array(z.object({
        name: z.string(),
        description: z.string(),
      })).default([]),
    }).default({ immediate: [], shortTerm: [], longTerm: [], resources: [] }),
    knowledgePrompt: z.string().optional(),
    claudeCode: z.object({
      applicable: z.boolean().default(false),
      skills: z.array(z.object({
        name: z.string(),
        description: z.string(),
        allowedTools: z.array(z.string()).default([]),
        instructions: z.string(),
      })).default([]),
      commands: z.array(z.object({
        name: z.string(),
        description: z.string(),
        argumentHint: z.string(),
        steps: z.string(),
      })).default([]),
      agents: z.array(z.object({
        name: z.string(),
        description: z.string(),
        model: z.enum(['haiku', 'sonnet', 'opus']),
        systemPrompt: z.string(),
      })).default([]),
      hooks: z.array(z.object({
        name: z.string(),
        event: z.enum(['PreToolUse', 'PostToolUse', 'Stop', 'Notification']),
        matcher: z.string(),
        command: z.string(),
        purpose: z.string(),
      })).default([]),
      rules: z.array(z.object({
        name: z.string(),
        rule: z.string(),
        rationale: z.string(),
        goodExample: z.string(),
        badExample: z.string(),
      })).default([]),
    }).default({ applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] }),
  }),
})

/**
 * GET /api/videos/[id]/insights
 * Retrieve existing extraction for a video
 * Returns null if no extraction has been generated yet
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const videoId = parseInt(id, 10)
  const timer = startApiTimer(`/api/videos/${id}/insights`, 'GET')
  try {
    if (isNaN(videoId)) {
      timer.end(400)
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 })
    }

    const result = await getExtractionForVideo(videoId)

    if (!result) {
      timer.end(200, { found: false })
      return NextResponse.json({
        extraction: null,
        generatedAt: null,
      })
    }

    timer.end(200, { found: true })
    return NextResponse.json({
      extraction: result.extraction,
      generatedAt: result.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error fetching insights:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/videos/[id]/insights
 * Save completed extraction (upserts - creates or replaces)
 * Called by client after streaming extraction completes
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const videoId = parseInt(id, 10)
  const timer = startApiTimer(`/api/videos/${id}/insights`, 'POST')
  try {
    if (isNaN(videoId)) {
      timer.end(400)
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 })
    }

    // Require authenticated session for POST (skip in dev — no login locally)
    if (process.env.NODE_ENV !== 'development') {
      const session = await auth.api.getSession({ headers: await headers() })
      if (!session) {
        timer.end(401)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      timer.end(400)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const parseResult = extractionSchema.safeParse(rawBody)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      timer.end(400)
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid extraction format' },
        { status: 400 }
      )
    }

    const { extraction } = parseResult.data

    const result = await upsertExtraction(videoId, extraction)

    timer.end(200)
    return NextResponse.json({
      extraction: result.extraction,
      generatedAt: result.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error saving insights:', error)
    timer.end(500)
    return NextResponse.json(
      { error: 'Failed to save insights' },
      { status: 500 }
    )
  }
}
