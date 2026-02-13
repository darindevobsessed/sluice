import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FileText } from 'lucide-react';
import { InsightSection } from '../InsightSection';

describe('InsightSection', () => {
  it('renders section with title and icon', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="pending"
        content=""
      />
    );

    expect(screen.getByText('Summary')).toBeInTheDocument();
  });

  it('shows pending indicator for pending status', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="pending"
        content=""
      />
    );

    const indicator = screen.getByTestId('status-indicator-pending');
    expect(indicator).toBeInTheDocument();
  });

  it('shows working indicator with spin for working status', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="working"
        content=""
      />
    );

    const indicator = screen.getByTestId('status-indicator-working');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass('animate-spin');
  });

  it('shows done indicator for done status', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="done"
        content="Test content"
      />
    );

    const indicator = screen.getByTestId('status-indicator-done');
    expect(indicator).toBeInTheDocument();
  });

  it('shows content when provided', () => {
    const content = 'This is test content';
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="done"
        content={content}
      />
    );

    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('shows copy button when status is done and content exists', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="done"
        content="Test content"
      />
    );

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('does not show copy button when status is pending', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="pending"
        content=""
      />
    );

    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
  });

  it('does not show copy button when status is working', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="working"
        content="Partial content"
      />
    );

    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
  });

  it('shows cursor animation when working', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="working"
        content="Partial"
      />
    );

    const cursor = screen.getByTestId('cursor-animation');
    expect(cursor).toBeInTheDocument();
  });

  it('does not show cursor animation when done', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="done"
        content="Complete content"
      />
    );

    expect(screen.queryByTestId('cursor-animation')).not.toBeInTheDocument();
  });

  it('handles empty content gracefully', () => {
    render(
      <InsightSection
        title="Summary"
        icon={FileText}
        status="pending"
        content=""
      />
    );

    // Should render without crashing
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });

  describe('GPU Performance Optimizations', () => {
    it('uses scoped transition properties instead of transition-all', () => {
      const { container } = render(
        <InsightSection
          title="Summary"
          icon={FileText}
          status="working"
          content=""
        />
      );

      // Find the card div (first child of container)
      const card = container.querySelector('div[class*="rounded-lg"]');
      expect(card).toHaveClass('transition-[border-color,box-shadow]');
      expect(card?.className).not.toContain('transition-all');
    });

    it('adds will-change-transform to working status spinner for GPU compositing', () => {
      render(
        <InsightSection
          title="Summary"
          icon={FileText}
          status="working"
          content=""
        />
      );

      const spinner = screen.getByTestId('status-indicator-working');
      expect(spinner).toHaveClass('will-change-transform');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('does not add will-change-transform to non-spinning icons', () => {
      render(
        <InsightSection
          title="Summary"
          icon={FileText}
          status="done"
          content="Test"
        />
      );

      const doneIcon = screen.getByTestId('status-indicator-done');
      expect(doneIcon?.className).not.toContain('will-change-transform');
    });
  });
});
