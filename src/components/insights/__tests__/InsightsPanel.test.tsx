import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { InsightsPanel } from '../InsightsPanel';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

const mockExtractionResult: ExtractionResult = {
  contentType: 'dev',
  summary: {
    tldr: 'Test TLDR',
    overview: 'Test overview',
    keyPoints: ['Point 1', 'Point 2'],
  },
  insights: [
    {
      title: 'Insight 1',
      timestamp: '0:00',
      explanation: 'Explanation',
      actionable: 'Action',
    },
  ],
  actionItems: {
    immediate: ['Do this now'],
    shortTerm: ['Do this soon'],
    longTerm: ['Do this later'],
    resources: [{ name: 'Resource', description: 'Description' }],
  },
  claudeCode: {
    applicable: false,
    skills: [],
    commands: [],
    agents: [],
    hooks: [],
    rules: [],
  },
};

describe('InsightsPanel', () => {
  describe('Empty State', () => {
    it('renders empty state by default', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="idle"
          extractionData={{}}
          onExtract={onExtract}
        />
      );

      expect(screen.getByText('No insights generated yet')).toBeInTheDocument();
    });

    it('shows extract insights button in empty state', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="idle"
          extractionData={{}}
          onExtract={onExtract}
        />
      );

      expect(screen.getByRole('button', { name: /extract insights/i })).toBeInTheDocument();
    });

    it('calls onExtract when extract button clicked', async () => {
      const user = userEvent.setup();
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="idle"
          extractionData={{}}
          onExtract={onExtract}
        />
      );

      const button = screen.getByRole('button', { name: /extract insights/i });
      await user.click(button);

      expect(onExtract).toHaveBeenCalledTimes(1);
    });

    it('shows helpful description in empty state', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="idle"
          extractionData={{}}
          onExtract={onExtract}
        />
      );

      expect(screen.getByText(/analyze this video/i)).toBeInTheDocument();
    });
  });

  describe('Streaming State', () => {
    it('shows sections when status is streaming', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="streaming"
          extractionData={{}}
          onExtract={onExtract}
        />
      );

      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Key Insights')).toBeInTheDocument();
      expect(screen.getByText('Action Items')).toBeInTheDocument();
    });

    it('disables extract button during streaming', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="streaming"
          extractionData={{}}
          onExtract={onExtract}
        />
      );

      // Should not show extract button when streaming
      expect(screen.queryByRole('button', { name: /extract insights/i })).not.toBeInTheDocument();
    });
  });

  describe('Complete State', () => {
    it('shows sections with complete data', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="done"
          extractionData={mockExtractionResult}
          onExtract={onExtract}
        />
      );

      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Key Insights')).toBeInTheDocument();
      expect(screen.getByText('Action Items')).toBeInTheDocument();
    });

    it('shows regenerate button when done', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="done"
          extractionData={mockExtractionResult}
          onExtract={onExtract}
        />
      );

      expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    });

    it('calls onExtract when regenerate button clicked', async () => {
      const user = userEvent.setup();
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="done"
          extractionData={mockExtractionResult}
          onExtract={onExtract}
        />
      );

      const button = screen.getByRole('button', { name: /regenerate/i });
      await user.click(button);

      expect(onExtract).toHaveBeenCalledTimes(1);
    });

    it('shows Claude Code section when applicable', () => {
      const onExtract = vi.fn();
      const dataWithClaudeCode: ExtractionResult = {
        ...mockExtractionResult,
        claudeCode: {
          applicable: true,
          skills: [
            {
              name: 'Test Skill',
              description: 'A test skill',
              allowedTools: ['bash'],
              instructions: 'Do something',
            },
          ],
          commands: [],
          agents: [],
          hooks: [],
          rules: [],
        },
      };

      render(
        <InsightsPanel
          status="done"
          extractionData={dataWithClaudeCode}
          onExtract={onExtract}
        />
      );

      expect(screen.getByText('Claude Code Plugins')).toBeInTheDocument();
    });

    it('does not show Claude Code section when not applicable', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="done"
          extractionData={mockExtractionResult}
          onExtract={onExtract}
        />
      );

      expect(screen.queryByText('Claude Code Plugins')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when status is error', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="error"
          extractionData={{}}
          error="Failed to extract insights"
          onExtract={onExtract}
        />
      );

      // Check for heading
      expect(screen.getByRole('heading', { name: /failed to extract insights/i })).toBeInTheDocument();
    });

    it('shows retry button in error state', () => {
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="error"
          extractionData={{}}
          error="Something went wrong"
          onExtract={onExtract}
        />
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls onExtract when retry button clicked', async () => {
      const user = userEvent.setup();
      const onExtract = vi.fn();
      render(
        <InsightsPanel
          status="error"
          extractionData={{}}
          error="Something went wrong"
          onExtract={onExtract}
        />
      );

      const button = screen.getByRole('button', { name: /try again/i });
      await user.click(button);

      expect(onExtract).toHaveBeenCalledTimes(1);
    });
  });
});
