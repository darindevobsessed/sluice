import { describe, it, expect } from 'vitest'
import {
  formatSkillForCopy,
  formatCommandForCopy,
  formatAgentForCopy,
  formatRuleForCopy,
  formatHookForCopy,
  buildExtractionPrompt,
} from '../index'
import type {
  ClaudeSkill,
  ClaudeCommand,
  ClaudeAgent,
  ClaudeRule,
  ClaudeHook,
  ExtractionResult,
} from '../index'

describe('index exports', () => {
  it('exports all format functions', () => {
    expect(typeof formatSkillForCopy).toBe('function')
    expect(typeof formatCommandForCopy).toBe('function')
    expect(typeof formatAgentForCopy).toBe('function')
    expect(typeof formatRuleForCopy).toBe('function')
    expect(typeof formatHookForCopy).toBe('function')
    expect(typeof buildExtractionPrompt).toBe('function')
  })

  it('format functions are callable', () => {
    const skill: ClaudeSkill = {
      name: 'test',
      description: 'test',
      allowedTools: [],
      instructions: 'test',
    }

    const command: ClaudeCommand = {
      name: 'test',
      description: 'test',
      argumentHint: '',
      steps: 'test',
    }

    const agent: ClaudeAgent = {
      name: 'test',
      description: 'test',
      model: 'sonnet',
      systemPrompt: 'test',
    }

    const rule: ClaudeRule = {
      name: 'test',
      rule: 'test',
      rationale: 'test',
      goodExample: 'test',
      badExample: 'test',
    }

    const hook: ClaudeHook = {
      name: 'test',
      event: 'PreToolUse',
      matcher: 'test',
      command: 'test',
      purpose: 'test',
    }

    expect(formatSkillForCopy(skill)).toContain('name: test')
    expect(formatCommandForCopy(command)).toContain('name: test')
    expect(formatAgentForCopy(agent)).toContain('name: test')
    expect(formatRuleForCopy(rule)).toContain('## test')
    expect(formatHookForCopy(hook)).toContain('name: test')
  })

  it('buildExtractionPrompt is callable', () => {
    const video = {
      title: 'Test',
      channel: 'Test',
      transcript: 'Test',
    }

    const prompt = buildExtractionPrompt(video)

    expect(prompt).toContain('Test')
  })

  it('types are correctly exported', () => {
    // This is a compile-time check, but we can also check at runtime
    const extraction: Partial<ExtractionResult> = {
      contentType: 'dev',
      summary: {
        tldr: 'Test',
        overview: 'Test',
        keyPoints: ['Test'],
      },
    }

    expect(extraction.contentType).toBe('dev')
    expect(extraction.summary?.tldr).toBe('Test')
  })
})
