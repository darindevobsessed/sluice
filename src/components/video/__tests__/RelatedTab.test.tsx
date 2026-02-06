import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RelatedTab } from '../RelatedTab'
import type { RelatedChunk } from '@/lib/graph/types'

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock fetch
global.fetch = vi.fn()

describe('RelatedTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading skeleton initially', () => {
      // Make fetch never resolve to keep loading state
      vi.mocked(global.fetch).mockReturnValue(
        new Promise(() => {}) as Promise<Response>
      )

      render(<RelatedTab videoId={1} />)

      // Should show 3 skeleton cards
      const skeletons = screen.getAllByTestId('loading-skeleton')
      expect(skeletons).toHaveLength(3)
    })
  })

  describe('loaded state', () => {
    it('shows related chunks after loading', async () => {
      const mockData: RelatedChunk[] = [
        {
          chunkId: 1,
          content: 'This is related content from another video',
          startTime: 0,
          endTime: 30,
          similarity: 0.85,
          video: {
            id: 2,
            title: 'Related Video Title',
            channel: 'Test Channel',
            youtubeId: 'abc123',
          },
        },
        {
          chunkId: 2,
          content: 'Another related piece of content',
          startTime: 60,
          endTime: 90,
          similarity: 0.72,
          video: {
            id: 3,
            title: 'Another Related Video',
            channel: 'Another Channel',
            youtubeId: 'def456',
          },
        },
      ]

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ related: mockData }),
      } as Response)

      render(<RelatedTab videoId={1} />)

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
      })

      // Should show both related chunks
      expect(screen.getByText('Related Video Title')).toBeInTheDocument()
      expect(screen.getByText('Another Related Video')).toBeInTheDocument()
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
      expect(screen.getByText('Another Channel')).toBeInTheDocument()
    })

    it('shows similarity percentage for each card', async () => {
      const mockData: RelatedChunk[] = [
        {
          chunkId: 1,
          content: 'Related content',
          startTime: 0,
          endTime: 30,
          similarity: 0.85,
          video: {
            id: 2,
            title: 'Video',
            channel: 'Channel',
            youtubeId: 'abc',
          },
        },
      ]

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ related: mockData }),
      } as Response)

      render(<RelatedTab videoId={1} />)

      await waitFor(() => {
        expect(screen.getByText('85% similar')).toBeInTheDocument()
      })
    })

    it('each card links to the related video', async () => {
      const mockData: RelatedChunk[] = [
        {
          chunkId: 1,
          content: 'Related content',
          startTime: 0,
          endTime: 30,
          similarity: 0.85,
          video: {
            id: 2,
            title: 'Video',
            channel: 'Channel',
            youtubeId: 'abc',
          },
        },
      ]

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ related: mockData }),
      } as Response)

      render(<RelatedTab videoId={1} />)

      await waitFor(() => {
        const link = screen.getByRole('link')
        expect(link).toHaveAttribute('href', '/videos/2')
      })
    })
  })

  describe('empty state', () => {
    it('shows empty state when no results', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ related: [] }),
      } as Response)

      render(<RelatedTab videoId={1} />)

      await waitFor(() => {
        expect(
          screen.getByText(/no related content found yet/i)
        ).toBeInTheDocument()
        expect(
          screen.getByText(/add more videos to discover connections/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('error state', () => {
    it('shows error state on fetch failure', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'))

      render(<RelatedTab videoId={1} />)

      await waitFor(() => {
        expect(
          screen.getByText(/couldn't load related content/i)
        ).toBeInTheDocument()
        expect(screen.getByText(/try refreshing/i)).toBeInTheDocument()
      })
    })

    it('shows error state on non-ok response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response)

      render(<RelatedTab videoId={1} />)

      await waitFor(() => {
        expect(
          screen.getByText(/couldn't load related content/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('API integration', () => {
    it('fetches from correct endpoint', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ related: [] }),
      } as Response)

      render(<RelatedTab videoId={42} />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/videos/42/related')
      })
    })
  })
})
