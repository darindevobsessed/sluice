import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('EmptyState', () => {
  it('renders the main heading', () => {
    render(<EmptyState />);
    expect(screen.getByText('Start building your knowledge vault')).toBeInTheDocument();
  });

  it('renders the descriptive tagline', () => {
    render(<EmptyState />);
    expect(screen.getByText(/Save videos.*Search transcripts.*Extract insights/)).toBeInTheDocument();
  });

  it('renders a CTA button linking to add page', () => {
    render(<EmptyState />);
    const link = screen.getByRole('link', { name: /add your first video/i });
    expect(link).toHaveAttribute('href', '/add');
  });
});
