/**
 * API route to retrieve the agent token.
 * Returns the token from .agent-token file if available.
 */
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const TOKEN_FILE = '.agent-token'

export async function GET() {
  const tokenPath = path.join(process.cwd(), TOKEN_FILE)

  try {
    if (!fs.existsSync(tokenPath)) {
      return NextResponse.json(
        {
          error: 'Agent not running',
          available: false
        },
        { status: 503 }
      )
    }

    const token = fs.readFileSync(tokenPath, 'utf-8').trim()

    if (!token) {
      return NextResponse.json(
        {
          error: 'Token file is empty',
          available: false
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      token,
      available: true
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: `Failed to read token: ${errorMessage}`,
        available: false
      },
      { status: 503 }
    )
  }
}
