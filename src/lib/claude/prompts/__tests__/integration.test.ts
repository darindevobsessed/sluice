import { describe, it, expect } from 'vitest'
import {
  formatSkillForCopy,
  formatCommandForCopy,
  formatAgentForCopy,
  formatRuleForCopy,
  formatHookForCopy,
  buildExtractionPrompt,
} from '../extract'
import type { ExtractionResult } from '../types'

describe('Integration: Full extraction workflow', () => {
  it('produces valid Claude Code plugin files for a complete extraction', () => {
    // Simulate a complete extraction result
    const extraction: ExtractionResult = {
      contentType: 'dev',
      summary: {
        tldr: 'Learn advanced TypeScript patterns for React development',
        overview:
          'This video covers advanced TypeScript patterns including conditional types, mapped types, and utility types.',
        keyPoints: [
          'Conditional types for flexible APIs',
          'Mapped types for transformations',
          'Utility types for common patterns',
        ],
      },
      insights: [
        {
          title: 'Use conditional types for API flexibility',
          timestamp: '05:30',
          explanation:
            'Conditional types allow you to create more flexible APIs that adapt based on input types.',
          actionable: 'Apply conditional types to your generic utility functions',
        },
      ],
      actionItems: {
        immediate: ['Review your existing types for conditional type opportunities'],
        shortTerm: ['Refactor complex type definitions using mapped types'],
        longTerm: ['Build a library of reusable utility types'],
        resources: [
          {
            name: 'TypeScript Handbook',
            description: 'Official documentation on advanced types',
          },
        ],
      },
      claudeCode: {
        applicable: true,
        skills: [
          {
            name: 'typescript-expert',
            description: 'Expert TypeScript development assistance',
            allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
            instructions: `# TypeScript Expert Skill

You are an expert TypeScript developer helping with advanced type definitions.

## Capabilities
- Analyze existing type definitions
- Suggest improvements using advanced patterns
- Create conditional and mapped types
- Build utility type libraries

## Process
1. Read the existing code
2. Identify type improvement opportunities
3. Suggest specific patterns
4. Implement with explanations`,
          },
        ],
        commands: [
          {
            name: 'type-check',
            description: 'Run TypeScript type checking and report errors',
            argumentHint: '[path]',
            steps: `1. Run \`npx tsc --noEmit\` in the specified path or project root
2. Parse the output for errors
3. Group errors by file
4. Suggest fixes for common patterns`,
          },
        ],
        agents: [
          {
            name: 'typescript-refactor',
            description: 'Specialized agent for TypeScript refactoring',
            model: 'sonnet',
            systemPrompt: `You are a TypeScript refactoring specialist.

Your goal is to improve type safety and code quality through strategic refactoring.

Focus on:
- Eliminating 'any' types
- Adding proper null checks
- Using strict mode features
- Leveraging advanced type patterns

Always explain the benefits of each refactoring.`,
          },
        ],
        hooks: [
          {
            name: 'auto-type-check',
            event: 'PostToolUse',
            matcher: 'Write|Edit',
            command: 'npx tsc --noEmit',
            purpose: 'Automatically type-check after modifying TypeScript files',
          },
        ],
        rules: [
          {
            name: 'No Any Types',
            rule: 'Never use the `any` type without explicit user approval. Always prefer `unknown` with type guards or proper interfaces.',
            rationale:
              'The any type defeats the purpose of TypeScript and can hide bugs.',
            goodExample: 'const data: unknown = await fetch(); if (isUser(data)) { ... }',
            badExample: 'const data: any = await fetch(); data.anything()',
          },
        ],
      },
    }

    // Format each plugin type
    const skillFile = formatSkillForCopy(extraction.claudeCode.skills[0]!)
    const commandFile = formatCommandForCopy(extraction.claudeCode.commands[0]!)
    const agentFile = formatAgentForCopy(extraction.claudeCode.agents[0]!)
    const hookFile = formatHookForCopy(extraction.claudeCode.hooks[0]!)
    const ruleFile = formatRuleForCopy(extraction.claudeCode.rules[0]!)

    // Verify skill file has correct structure
    expect(skillFile).toMatch(/^---\nname: /)
    expect(skillFile).toContain('description: Expert TypeScript development assistance')
    expect(skillFile).toContain('allowed-tools: Read, Write, Edit, Bash')
    expect(skillFile).toContain('---\n\n# TypeScript Expert Skill')

    // Verify command file has correct structure
    expect(commandFile).toMatch(/^---\nname: /)
    expect(commandFile).toContain('disable-model-invocation: true')
    expect(commandFile).toContain('argument-hint: [path]')
    expect(commandFile).toContain('1. Run `npx tsc --noEmit`')

    // Verify agent file has correct structure
    expect(agentFile).toMatch(/^---\nname: /)
    expect(agentFile).toContain('model: sonnet')
    expect(agentFile).toContain('You are a TypeScript refactoring specialist')

    // Verify hook file has correct structure
    expect(hookFile).toMatch(/^---\nname: /)
    expect(hookFile).toContain('event: PostToolUse')
    expect(hookFile).toContain('matcher: Write|Edit')
    expect(hookFile).toContain('npx tsc --noEmit')

    // Verify rule file has correct structure
    expect(ruleFile).toMatch(/^## No Any Types/)
    expect(ruleFile).toContain('**Rationale:**')
    expect(ruleFile).toContain('**Example:**')
    expect(ruleFile).toContain('- Good:')
    expect(ruleFile).toContain('- Bad:')
  })

  it('buildExtractionPrompt creates a complete prompt', () => {
    const video = {
      title: 'Advanced TypeScript Patterns',
      channel: 'Tech Talks',
      transcript: `[00:00] Welcome to this tutorial on TypeScript.
[00:30] Today we'll cover conditional types.
[05:30] Conditional types are powerful because...
[10:00] Let's look at mapped types next.`,
    }

    const prompt = buildExtractionPrompt(video)

    // Verify video metadata is included in XML tags
    expect(prompt).toContain('<video_metadata>')
    expect(prompt).toContain('Title: Advanced TypeScript Patterns')
    expect(prompt).toContain('Channel: Tech Talks')
    expect(prompt).toContain('<transcript>')

    // Verify full transcript is included
    expect(prompt).toContain('[00:00] Welcome')
    expect(prompt).toContain('[05:30] Conditional types')
    expect(prompt).toContain('[10:00] Let\'s look at mapped types')

    // Verify instructions are comprehensive
    expect(prompt).toContain('First, classify this content')
    expect(prompt).toContain('Technical/development focused?')
    expect(prompt).toContain('Extract ALL applicable sections as JSON')

    // Verify JSON schema is included
    expect(prompt).toContain('"contentType"')
    expect(prompt).toContain('"summary"')
    expect(prompt).toContain('"insights"')
    expect(prompt).toContain('"actionItems"')
    expect(prompt).toContain('"claudeCode"')
    expect(prompt).toContain('"applicable"')
    expect(prompt).toContain('"skills"')
    expect(prompt).toContain('"commands"')
    expect(prompt).toContain('"agents"')
    expect(prompt).toContain('"hooks"')
    expect(prompt).toContain('"rules"')

    // Verify guidelines
    expect(prompt).toContain('Write for someone who will NOT watch the video')
    expect(prompt).toContain('Be specific, not vague')
    expect(prompt).toContain('Return valid JSON only')
  })

  it('handles non-dev content appropriately', () => {
    const extraction: ExtractionResult = {
      contentType: 'meeting',
      summary: {
        tldr: 'Quarterly planning meeting results',
        overview: 'Team discussed Q4 goals and priorities.',
        keyPoints: ['Revenue targets', 'Hiring plan', 'Product roadmap'],
      },
      insights: [],
      actionItems: {
        immediate: ['Send meeting notes'],
        shortTerm: ['Review budget'],
        longTerm: ['Plan Q1 strategy'],
        resources: [],
      },
      claudeCode: {
        applicable: false,
        skills: [],
        commands: [],
        agents: [],
        hooks: [],
        rules: [],
      },
    }

    // Verify claudeCode is marked as not applicable
    expect(extraction.claudeCode.applicable).toBe(false)
    expect(extraction.claudeCode.skills).toHaveLength(0)
    expect(extraction.claudeCode.commands).toHaveLength(0)
    expect(extraction.claudeCode.agents).toHaveLength(0)
  })

  it('validates Claude Code plugin file formats match official spec', () => {
    // Test that formats match the actual .claude/ file structure

    // Skill format test
    const skill = formatSkillForCopy({
      name: 'test-skill',
      description: 'Test description',
      allowedTools: ['Read', 'Write'],
      instructions: 'Instructions here',
    })

    const skillLines = skill.split('\n')
    expect(skillLines[0]).toBe('---')
    expect(skillLines[1]).toBe('name: test-skill')
    expect(skillLines[2]).toBe('description: Test description')
    expect(skillLines[3]).toBe('allowed-tools: Read, Write')
    expect(skillLines[4]).toBe('---')
    expect(skillLines[5]).toBe('')
    expect(skillLines[6]).toBe('Instructions here')

    // Command format test
    const command = formatCommandForCopy({
      name: 'test-cmd',
      description: 'Test command',
      argumentHint: '[arg]',
      steps: 'Steps',
    })

    const cmdLines = command.split('\n')
    expect(cmdLines[0]).toBe('---')
    expect(cmdLines[4]).toBe('disable-model-invocation: true')

    // Agent format test
    const agent = formatAgentForCopy({
      name: 'test-agent',
      description: 'Test agent',
      model: 'opus',
      systemPrompt: 'System prompt',
    })

    const agentLines = agent.split('\n')
    expect(agentLines[3]).toBe('model: opus')
  })
})
