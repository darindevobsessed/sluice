import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ClaudeCodeSection } from '../ClaudeCodeSection';
import type {
  ClaudeSkill,
  ClaudeCommand,
  ClaudeAgent,
  ClaudeHook,
  ClaudeRule,
} from '@/lib/claude/prompts/types';

const mockSkill: ClaudeSkill = {
  name: 'Test Skill',
  description: 'A test skill',
  allowedTools: ['bash', 'read'],
  instructions: 'Do something useful',
};

const mockCommand: ClaudeCommand = {
  name: 'test-command',
  description: 'A test command',
  argumentHint: '<arg>',
  steps: 'Step 1\nStep 2',
};

const mockAgent: ClaudeAgent = {
  name: 'Test Agent',
  description: 'A test agent',
  model: 'sonnet',
  systemPrompt: 'You are a test agent',
};

const mockHook: ClaudeHook = {
  name: 'Test Hook',
  event: 'PreToolUse',
  matcher: 'bash',
  command: 'echo test',
  purpose: 'Test purpose',
};

const mockRule: ClaudeRule = {
  name: 'Test Rule',
  rule: 'Always test',
  rationale: 'Testing is important',
  goodExample: 'Good example',
  badExample: 'Bad example',
};

describe('ClaudeCodeSection', () => {
  it('renders with golden/amber styling', () => {
    render(
      <ClaudeCodeSection
        skills={[]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    const container = screen.getByTestId('claude-code-section');
    expect(container).toHaveClass('border-amber-200');
    expect(container).toHaveClass('bg-amber-50/50');
  });

  it('renders skills group when skills provided', () => {
    render(
      <ClaudeCodeSection
        skills={[mockSkill]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    expect(screen.getByText('Skills')).toBeInTheDocument();
  });

  it('renders commands group when commands provided', () => {
    render(
      <ClaudeCodeSection
        skills={[]}
        commands={[mockCommand]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    expect(screen.getByText('Commands')).toBeInTheDocument();
  });

  it('renders agents group when agents provided', () => {
    render(
      <ClaudeCodeSection
        skills={[]}
        commands={[]}
        agents={[mockAgent]}
        hooks={[]}
        rules={[]}
      />
    );

    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('renders hooks group when hooks provided', () => {
    render(
      <ClaudeCodeSection
        skills={[]}
        commands={[]}
        agents={[]}
        hooks={[mockHook]}
        rules={[]}
      />
    );

    expect(screen.getByText('Hooks')).toBeInTheDocument();
  });

  it('renders rules group when rules provided', () => {
    render(
      <ClaudeCodeSection
        skills={[]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[mockRule]}
      />
    );

    expect(screen.getByText('Rules')).toBeInTheDocument();
  });

  it('renders collapsible groups', () => {
    render(
      <ClaudeCodeSection
        skills={[mockSkill]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    // Should show collapsed state initially (content not visible)
    const skillsButton = screen.getByRole('button', { name: /skills/i });
    expect(skillsButton).toBeInTheDocument();
  });

  it('expands and collapses groups on click', async () => {
    render(
      <ClaudeCodeSection
        skills={[mockSkill]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    const skillsButton = screen.getByRole('button', { name: /skills/i });
    await userEvent.setup().click(skillsButton);

    // After clicking, skill name should be visible
    expect(screen.getByText(mockSkill.name)).toBeInTheDocument();
  });

  it('shows individual copy buttons for each item', async () => {
    render(
      <ClaudeCodeSection
        skills={[mockSkill]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    // Expand the group
    const skillsButton = screen.getByRole('button', { name: /skills/i });
    await userEvent.setup().click(skillsButton);

    // Should have copy button for the skill
    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it('renders badge with count for each group', () => {
    render(
      <ClaudeCodeSection
        skills={[mockSkill, mockSkill]}
        commands={[mockCommand]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument(); // Skills count
    expect(screen.getByText('1')).toBeInTheDocument(); // Commands count
  });

  it('does not render groups with no items', () => {
    render(
      <ClaudeCodeSection
        skills={[mockSkill]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.queryByText('Commands')).not.toBeInTheDocument();
    expect(screen.queryByText('Agents')).not.toBeInTheDocument();
  });

  it('handles empty arrays gracefully', () => {
    render(
      <ClaudeCodeSection
        skills={[]}
        commands={[]}
        agents={[]}
        hooks={[]}
        rules={[]}
      />
    );

    // Should render container but no groups
    const container = screen.getByTestId('claude-code-section');
    expect(container).toBeInTheDocument();
    expect(screen.queryByText('Skills')).not.toBeInTheDocument();
  });
});
