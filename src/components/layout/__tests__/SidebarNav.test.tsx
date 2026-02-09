import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SidebarNav } from '../SidebarNav'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('SidebarNav', () => {
  it('renders all navigation items', () => {
    render(<SidebarNav />)

    expect(screen.getByText('Knowledge Bank')).toBeInTheDocument()
    expect(screen.getByText('Add Video')).toBeInTheDocument()
    expect(screen.getByText('Add Transcript')).toBeInTheDocument()
    expect(screen.getByText('Discovery')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders Add Transcript link with correct href', () => {
    render(<SidebarNav />)

    const addTranscriptLink = screen.getByRole('link', { name: /Add Transcript/i })
    expect(addTranscriptLink).toBeInTheDocument()
    expect(addTranscriptLink).toHaveAttribute('href', '/add-transcript')
  })

  it('renders navigation items in correct order', () => {
    render(<SidebarNav />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('Knowledge Bank')
    expect(links[1]).toHaveTextContent('Add Video')
    expect(links[2]).toHaveTextContent('Add Transcript')
    expect(links[3]).toHaveTextContent('Discovery')
    expect(links[4]).toHaveTextContent('Settings')
  })
})
