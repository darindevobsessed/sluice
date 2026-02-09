import { describe, it, expect } from 'vitest'
import {
  formatSkillForCopy,
  formatCommandForCopy,
  formatAgentForCopy,
  formatRuleForCopy,
  formatHookForCopy,
  buildExtractionPrompt,
} from '../extract'
import type {
  ClaudeSkill,
  ClaudeCommand,
  ClaudeAgent,
  ClaudeRule,
  ClaudeHook,
} from '../types'

describe('formatSkillForCopy', () => {
  it('formats a skill with correct frontmatter and instructions', () => {
    const skill: ClaudeSkill = {
      name: 'test-skill',
      description: 'A test skill',
      allowedTools: ['Read', 'Write', 'Bash'],
      instructions: 'These are the instructions\nfor the skill.',
    }

    const result = formatSkillForCopy(skill)

    expect(result).toBe(`---
name: test-skill
description: A test skill
allowed-tools: Read, Write, Bash
---

These are the instructions
for the skill.`)
  })

  it('handles single allowed tool', () => {
    const skill: ClaudeSkill = {
      name: 'simple-skill',
      description: 'Simple',
      allowedTools: ['Read'],
      instructions: 'Do something.',
    }

    const result = formatSkillForCopy(skill)

    expect(result).toContain('allowed-tools: Read')
  })

  it('handles empty allowed tools array', () => {
    const skill: ClaudeSkill = {
      name: 'no-tools',
      description: 'No tools',
      allowedTools: [],
      instructions: 'Instructions.',
    }

    const result = formatSkillForCopy(skill)

    expect(result).toContain('allowed-tools: ')
    expect(result).toContain('---\n\nInstructions.')
  })
})

describe('formatCommandForCopy', () => {
  it('formats a command with correct frontmatter and steps', () => {
    const command: ClaudeCommand = {
      name: 'test-command',
      description: 'A test command',
      argumentHint: '[filename]',
      steps: '1. Do this\n2. Do that',
    }

    const result = formatCommandForCopy(command)

    expect(result).toBe(`---
name: test-command
description: A test command
argument-hint: [filename]
disable-model-invocation: true
---

1. Do this
2. Do that`)
  })

  it('includes disable-model-invocation flag', () => {
    const command: ClaudeCommand = {
      name: 'cmd',
      description: 'Test',
      argumentHint: '',
      steps: 'Steps',
    }

    const result = formatCommandForCopy(command)

    expect(result).toContain('disable-model-invocation: true')
  })

  it('handles empty argument hint', () => {
    const command: ClaudeCommand = {
      name: 'no-args',
      description: 'No arguments',
      argumentHint: '',
      steps: 'Steps here',
    }

    const result = formatCommandForCopy(command)

    expect(result).toContain('argument-hint: \n')
  })
})

describe('formatAgentForCopy', () => {
  it('formats an agent with correct frontmatter and system prompt', () => {
    const agent: ClaudeAgent = {
      name: 'test-agent',
      description: 'A test agent',
      model: 'sonnet',
      systemPrompt: 'You are a helpful agent.\n\nYou help with testing.',
    }

    const result = formatAgentForCopy(agent)

    expect(result).toBe(`---
name: test-agent
description: A test agent
model: sonnet
---

You are a helpful agent.

You help with testing.`)
  })

  it('handles haiku model', () => {
    const agent: ClaudeAgent = {
      name: 'fast-agent',
      description: 'Fast agent',
      model: 'haiku',
      systemPrompt: 'Be fast.',
    }

    const result = formatAgentForCopy(agent)

    expect(result).toContain('model: haiku')
  })

  it('handles opus model', () => {
    const agent: ClaudeAgent = {
      name: 'smart-agent',
      description: 'Smart agent',
      model: 'opus',
      systemPrompt: 'Be smart.',
    }

    const result = formatAgentForCopy(agent)

    expect(result).toContain('model: opus')
  })
})

describe('formatRuleForCopy', () => {
  it('formats a rule with all sections', () => {
    const rule: ClaudeRule = {
      name: 'Test Rule',
      rule: 'Always do this thing.',
      rationale: 'Because it is important.',
      goodExample: 'This is good',
      badExample: 'This is bad',
    }

    const result = formatRuleForCopy(rule)

    expect(result).toBe(`## Test Rule

Always do this thing.

**Rationale:** Because it is important.

**Example:**
- Good: This is good
- Bad: This is bad`)
  })

  it('handles multi-line rule text', () => {
    const rule: ClaudeRule = {
      name: 'Multi-line Rule',
      rule: 'First line.\nSecond line.',
      rationale: 'Why',
      goodExample: 'Good',
      badExample: 'Bad',
    }

    const result = formatRuleForCopy(rule)

    expect(result).toContain('First line.\nSecond line.')
  })
})

describe('formatHookForCopy', () => {
  it('formats a hook with all fields', () => {
    const hook: ClaudeHook = {
      name: 'test-hook',
      event: 'PreToolUse',
      matcher: 'Write',
      command: 'echo "Writing file"',
      purpose: 'Log when files are written',
    }

    const result = formatHookForCopy(hook)

    expect(result).toBe(`---
name: test-hook
event: PreToolUse
matcher: Write
purpose: Log when files are written
---

echo "Writing file"`)
  })

  it('handles PostToolUse event', () => {
    const hook: ClaudeHook = {
      name: 'post-hook',
      event: 'PostToolUse',
      matcher: 'Bash',
      command: 'cleanup.sh',
      purpose: 'Cleanup after bash',
    }

    const result = formatHookForCopy(hook)

    expect(result).toContain('event: PostToolUse')
  })

  it('handles Stop event', () => {
    const hook: ClaudeHook = {
      name: 'stop-hook',
      event: 'Stop',
      matcher: '*',
      command: 'save_session.sh',
      purpose: 'Save session on stop',
    }

    const result = formatHookForCopy(hook)

    expect(result).toContain('event: Stop')
  })

  it('handles Notification event', () => {
    const hook: ClaudeHook = {
      name: 'notify-hook',
      event: 'Notification',
      matcher: 'error',
      command: 'notify.sh',
      purpose: 'Send notifications',
    }

    const result = formatHookForCopy(hook)

    expect(result).toContain('event: Notification')
  })
})

describe('buildExtractionPrompt', () => {
  it('includes video metadata in the prompt', () => {
    const video = {
      title: 'Test Video',
      channel: 'Test Channel',
      transcript: 'This is the transcript.',
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain('Title: Test Video')
    expect(result).toContain('Channel: Test Channel')
    expect(result).toContain('<video_metadata>')
    expect(result).toContain('<transcript>')
    expect(result).toContain('This is the transcript.')
  })

  it('includes knowledgePrompt field in the JSON schema', () => {
    const video = {
      title: 'Test Video',
      channel: 'Test Channel',
      transcript: 'This is the transcript.',
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain('"knowledgePrompt"')
  })

  it('includes instructions for generating knowledge transfer prompt', () => {
    const video = {
      title: 'Test Video',
      channel: 'Test Channel',
      transcript: 'This is the transcript.',
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain('knowledge transfer prompt')
    expect(result).toContain('teaching another AI assistant')
    expect(result).toContain('specific techniques')
    expect(result).toContain('act on this knowledge immediately')
  })

  it('includes instructions for content classification', () => {
    const video = {
      title: 'Any Video',
      channel: 'Any Channel',
      transcript: 'Content',
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain('First, classify this content')
    expect(result).toContain('Technical/development focused?')
    expect(result).toContain('Meeting/discussion?')
  })

  it('includes JSON schema structure', () => {
    const video = {
      title: 'Video',
      channel: 'Channel',
      transcript: 'Transcript',
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain('"contentType"')
    expect(result).toContain('"summary"')
    expect(result).toContain('"insights"')
    expect(result).toContain('"actionItems"')
    expect(result).toContain('"claudeCode"')
  })

  it('includes guidelines for extraction', () => {
    const video = {
      title: 'Video',
      channel: 'Channel',
      transcript: 'Transcript',
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain('Write for someone who will NOT watch the video')
    expect(result).toContain('Be specific, not vague')
    expect(result).toContain('Return valid JSON only')
  })

  it('handles special characters in video metadata', () => {
    const video = {
      title: 'Video with "quotes" and \'apostrophes\'',
      channel: 'Channel & Co.',
      transcript: 'Transcript with $pecial chars!',
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain('Video with "quotes" and \'apostrophes\'')
    expect(result).toContain('Channel & Co.')
    expect(result).toContain('Transcript with $pecial chars!')
  })

  it('handles long transcripts', () => {
    const longTranscript = 'A '.repeat(10000) + 'end'
    const video = {
      title: 'Long Video',
      channel: 'Long Channel',
      transcript: longTranscript,
    }

    const result = buildExtractionPrompt(video)

    expect(result).toContain(longTranscript)
    expect(result.length).toBeGreaterThan(20000)
  })
})

describe('Edge cases', () => {
  it('formatSkillForCopy handles skills with special characters in name', () => {
    const skill: ClaudeSkill = {
      name: 'skill-with-special_chars.123',
      description: 'Test',
      allowedTools: ['Read'],
      instructions: 'Test',
    }

    const result = formatSkillForCopy(skill)

    expect(result).toContain('name: skill-with-special_chars.123')
  })

  it('formatCommandForCopy handles multiline steps', () => {
    const command: ClaudeCommand = {
      name: 'multi-step',
      description: 'Multiple steps',
      argumentHint: '[file]',
      steps: '1. First step\n2. Second step\n3. Third step',
    }

    const result = formatCommandForCopy(command)

    expect(result).toContain('1. First step')
    expect(result).toContain('2. Second step')
    expect(result).toContain('3. Third step')
  })

  it('formatAgentForCopy handles empty system prompt', () => {
    const agent: ClaudeAgent = {
      name: 'empty-agent',
      description: 'Empty prompt',
      model: 'sonnet',
      systemPrompt: '',
    }

    const result = formatAgentForCopy(agent)

    expect(result).toBe(`---
name: empty-agent
description: Empty prompt
model: sonnet
---

`)
  })

  it('formatRuleForCopy handles empty examples', () => {
    const rule: ClaudeRule = {
      name: 'No Examples',
      rule: 'Do something',
      rationale: 'Because',
      goodExample: '',
      badExample: '',
    }

    const result = formatRuleForCopy(rule)

    expect(result).toContain('- Good: ')
    expect(result).toContain('- Bad: ')
  })

  it('formatHookForCopy handles complex commands', () => {
    const hook: ClaudeHook = {
      name: 'complex-hook',
      event: 'PreToolUse',
      matcher: 'Write',
      command: 'if [ -f "$FILE" ]; then echo "exists"; fi',
      purpose: 'Check file existence',
    }

    const result = formatHookForCopy(hook)

    expect(result).toContain('if [ -f "$FILE" ]; then echo "exists"; fi')
  })
})
