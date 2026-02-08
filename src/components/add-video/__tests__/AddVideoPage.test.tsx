import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AddVideoPage } from '../AddVideoPage'

// Mock next/navigation for useSearchParams
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

// Mock the youtube module
vi.mock('@/lib/youtube', () => ({
  parseYouTubeUrl: vi.fn((url: string) => {
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0]
      return { isValid: true, videoId }
    }
    return { isValid: false, videoId: null }
  }),
  fetchVideoMetadata: vi.fn(async () => ({
    title: 'Test Video Title',
    author_name: 'Test Channel',
    thumbnail_url: 'https://example.com/thumb.jpg',
  })),
}))

// Mock fetch for transcript API
global.fetch = vi.fn()

describe('AddVideoPage - Transcript Auto-fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debounces URL input and does not fetch immediately', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);

    // Type URL
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    // Should not fetch immediately (before debounce completes)
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/youtube/transcript',
      expect.anything()
    );

    // Wait just 400ms - still before the 500ms debounce
    await new Promise(resolve => setTimeout(resolve, 400));

    // Still should not have fetched
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/youtube/transcript',
      expect.anything()
    );
  }, 10000);

  it('fetches transcript after metadata loads and debounce completes', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    // Mock successful transcript fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transcript: 'Test transcript content' }),
    } as Response);

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);

    // Type URL
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    // Wait for metadata to load (mocked) and debounce to complete
    await waitFor(() => {
      expect(screen.getByText(/test video title/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should now fetch transcript via POST
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/youtube/transcript',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: 'abc123' }),
          signal: expect.any(AbortSignal),
        })
      );
    }, { timeout: 3000 });
  }, 10000);

  it('shows transcript fetch loading state', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    // Mock slow transcript fetch
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ success: true, transcript: 'Test transcript' }),
          } as Response);
        }, 2000);
      })
    );

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    await waitFor(() => {
      expect(screen.getByText(/test video title/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/fetching transcript/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  }, 10000);

  it('shows auto-fetched indicator on success', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transcript: 'Test transcript content' }),
    } as Response);

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    await waitFor(() => {
      expect(screen.getByText(/test video title/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for transcript to load
    await waitFor(() => {
      expect(screen.getByText(/auto-fetched from youtube/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  }, 10000);

  it('shows error with retry button on failure', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Rate limited' }),
    } as Response);

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    await waitFor(() => {
      expect(screen.getByText(/test video title/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should show retry button
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  }, 10000);

  it('cancels pending fetch when URL changes', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    const abortedRequests: AbortSignal[] = [];

    mockFetch.mockImplementation((_url, options) => {
      const signal = (options as RequestInit)?.signal as AbortSignal;
      if (signal) {
        abortedRequests.push(signal);
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ success: true, transcript: 'Test transcript' }),
          } as Response);
        }, 2000);
      });
    });

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);

    // Type first URL
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    await waitFor(() => {
      expect(screen.getByText(/test video title/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Clear and type new URL
    await user.clear(input);
    await user.type(input, 'https://youtube.com/watch?v=xyz789');

    // First request should be aborted
    await waitFor(() => {
      expect(abortedRequests[0]?.aborted).toBe(true);
    }, { timeout: 3000 });
  }, 10000);

  it('allows manual paste when auto-fetch is available', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transcript: 'Auto-fetched transcript' }),
    } as Response);

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    await waitFor(() => {
      expect(screen.getByText(/auto-fetched from youtube/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // User should still be able to edit the transcript
    const textarea = screen.getByRole('textbox', { name: /transcript/i });
    await user.clear(textarea);
    await user.type(textarea, 'Manually pasted transcript');

    expect(textarea).toHaveValue('Manually pasted transcript');
  }, 10000);

  it('handles AbortError gracefully when request is cancelled', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(global.fetch);

    mockFetch.mockRejectedValueOnce(new DOMException('The user aborted a request.', 'AbortError'));

    render(<AddVideoPage />);

    const input = screen.getByLabelText(/what video would you like to add/i);
    await user.type(input, 'https://youtube.com/watch?v=abc123');

    await waitFor(() => {
      expect(screen.getByText(/test video title/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait a bit for any potential error to appear
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should not show error for aborted requests
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
  }, 10000)
})

describe('AddVideoPage - URL Prefill from Query Param', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete('url')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should prefill URL input when url query param is present', async () => {
    const mockFetch = vi.mocked(global.fetch)

    // Set the URL param
    mockSearchParams.set('url', 'https://youtube.com/watch?v=prefilled123')

    // Mock transcript fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transcript: 'Prefilled transcript' }),
    } as Response)

    render(<AddVideoPage />)

    // Should show URL in input
    const input = screen.getByLabelText(/what video would you like to add/i)
    await waitFor(() => {
      expect(input).toHaveValue('https://youtube.com/watch?v=prefilled123')
    }, { timeout: 3000 })
  }, 10000)

  it('should auto-fetch metadata when url query param is present', async () => {
    const mockFetch = vi.mocked(global.fetch)

    // Set the URL param
    mockSearchParams.set('url', 'https://youtube.com/watch?v=prefilled456')

    // Mock transcript fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transcript: 'Prefilled transcript' }),
    } as Response)

    render(<AddVideoPage />)

    // Should show video metadata after debounce
    await waitFor(() => {
      expect(screen.getByText(/test video title/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  }, 10000)

  it('should auto-fetch transcript when url query param is present', async () => {
    const mockFetch = vi.mocked(global.fetch)

    // Set the URL param
    mockSearchParams.set('url', 'https://youtube.com/watch?v=prefilled789')

    // Mock transcript fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transcript: 'Prefilled transcript content' }),
    } as Response)

    render(<AddVideoPage />)

    // Should trigger transcript fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/youtube/transcript',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: 'prefilled789' }),
        })
      )
    }, { timeout: 3000 })
  }, 10000)

  it('should not prefill when url query param is empty', async () => {
    const mockFetch = vi.mocked(global.fetch)

    // No URL param set
    render(<AddVideoPage />)

    const input = screen.getByLabelText(/what video would you like to add/i)

    // Should be empty
    expect(input).toHaveValue('')

    // Should not fetch
    await new Promise(resolve => setTimeout(resolve, 600))
    expect(mockFetch).not.toHaveBeenCalled()
  }, 10000)

  it('should handle invalid URL in query param gracefully', async () => {
    const mockFetch = vi.mocked(global.fetch)

    // Set invalid URL param
    mockSearchParams.set('url', 'not-a-valid-url')

    render(<AddVideoPage />)

    const input = screen.getByLabelText(/what video would you like to add/i)

    // Should show URL in input
    await waitFor(() => {
      expect(input).toHaveValue('not-a-valid-url')
    })

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid youtube url/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should not fetch metadata or transcript
    expect(mockFetch).not.toHaveBeenCalled()
  }, 10000)
})
