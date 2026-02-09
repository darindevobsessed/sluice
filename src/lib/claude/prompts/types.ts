export interface ExtractionResult {
  contentType: 'dev' | 'meeting' | 'educational' | 'thought-leadership' | 'general'
  summary: {
    tldr: string
    overview: string
    keyPoints: string[]
  }
  insights: Array<{
    title: string
    timestamp: string
    explanation: string
    actionable: string
  }>
  actionItems: {
    immediate: string[]
    shortTerm: string[]
    longTerm: string[]
    resources: Array<{ name: string; description: string }>
  }
  knowledgePrompt?: string
  claudeCode: {
    applicable: boolean
    skills: ClaudeSkill[]
    commands: ClaudeCommand[]
    agents: ClaudeAgent[]
    hooks: ClaudeHook[]
    rules: ClaudeRule[]
  }
}

export interface ClaudeSkill {
  name: string
  description: string
  allowedTools: string[]
  instructions: string
}

export interface ClaudeCommand {
  name: string
  description: string
  argumentHint: string
  steps: string
}

export interface ClaudeAgent {
  name: string
  description: string
  model: 'haiku' | 'sonnet' | 'opus'
  systemPrompt: string
}

export interface ClaudeHook {
  name: string
  event: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification'
  matcher: string
  command: string
  purpose: string
}

export interface ClaudeRule {
  name: string
  rule: string
  rationale: string
  goodExample: string
  badExample: string
}
