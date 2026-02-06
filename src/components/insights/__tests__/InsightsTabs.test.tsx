import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsightsTabs } from '../InsightsTabs';
import { AgentProvider } from '@/lib/agent/AgentProvider';
import type { Video } from '@/lib/db/schema';

// Mock fetch for agent token
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AgentConnection
vi.mock('@/lib/agent/connection', () => {
  class MockAgentConnection {
    private statusCallback: ((status: string) => void) | null = null;

    onStatusChange(callback: (status: string) => void) {
      this.statusCallback = callback;
      return () => {
        this.statusCallback = null;
      };
    }

    async connect() {
      // Simulate successful connection
      if (this.statusCallback) {
        this.statusCallback('connected');
      }
    }

    disconnect() {
      // no-op
    }

    generateInsight() {
      return 'mock-id';
    }

    cancelInsight() {
      // no-op
    }
  }

  return {
    AgentConnection: MockAgentConnection,
  };
});

const mockVideo: Video = {
  id: 1,
  youtubeId: 'test123',
  title: 'Test Video',
  channel: 'Test Channel',
  thumbnail: 'https://example.com/thumb.jpg',
  duration: 300,
  transcript: '0:00\nIntro\n1:00\nContent',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  publishedAt: null,
};

describe('InsightsTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Mock all fetch calls
    mockFetch.mockImplementation((url: string) => {
      // Agent token endpoint - return available by default
      if (url.includes('/api/agent/token')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ available: true, token: 'mock-token' }),
        });
      }
      // Insights endpoint - return no insights by default
      if (url.includes('/insights')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ extraction: null, generatedAt: null }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  it('renders both tabs', () => {
    const onSeek = vi.fn();
    render(
      <AgentProvider>
        <InsightsTabs video={mockVideo} onSeek={onSeek} />
      </AgentProvider>
    );

    expect(screen.getByRole('tab', { name: /transcript/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /insights/i })).toBeInTheDocument();
  });

  it('shows Transcript tab content by default', () => {
    const onSeek = vi.fn();
    render(
      <AgentProvider>
        <InsightsTabs video={mockVideo} onSeek={onSeek} />
      </AgentProvider>
    );

    // TranscriptView should be visible
    expect(screen.getByText('Intro')).toBeInTheDocument();
  });

  it('switches to Insights tab when clicked', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    render(
      <AgentProvider>
        <InsightsTabs video={mockVideo} onSeek={onSeek} />
      </AgentProvider>
    );

    const insightsTab = screen.getByRole('tab', { name: /insights/i });
    await user.click(insightsTab);

    // Should show empty state by default
    expect(screen.getByText('No insights generated yet')).toBeInTheDocument();
  });

  it('passes video transcript to TranscriptView', () => {
    const onSeek = vi.fn();
    render(
      <AgentProvider>
        <InsightsTabs video={mockVideo} onSeek={onSeek} />
      </AgentProvider>
    );

    // Content from transcript should be visible
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('passes onSeek callback to TranscriptView', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    render(
      <AgentProvider>
        <InsightsTabs video={mockVideo} onSeek={onSeek} />
      </AgentProvider>
    );

    // Click on a timestamp button
    const timestampButton = screen.getByRole('button', { name: '0:00' });
    await user.click(timestampButton);

    expect(onSeek).toHaveBeenCalledWith(0);
  });

  it('handles video with no transcript', () => {
    const onSeek = vi.fn();
    const videoNoTranscript: Video = {
      ...mockVideo,
      transcript: null,
    };
    render(
      <AgentProvider>
        <InsightsTabs video={videoNoTranscript} onSeek={onSeek} />
      </AgentProvider>
    );

    expect(screen.getByText('No transcript available')).toBeInTheDocument();
  });

  it('maintains tab state when switching back and forth', async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    render(
      <AgentProvider>
        <InsightsTabs video={mockVideo} onSeek={onSeek} />
      </AgentProvider>
    );

    // Start on Transcript tab
    expect(screen.getByText('Intro')).toBeInTheDocument();

    // Switch to Insights
    const insightsTab = screen.getByRole('tab', { name: /insights/i });
    await user.click(insightsTab);
    expect(screen.getByText('No insights generated yet')).toBeInTheDocument();

    // Switch back to Transcript
    const transcriptTab = screen.getByRole('tab', { name: /transcript/i });
    await user.click(transcriptTab);
    expect(screen.getByText('Intro')).toBeInTheDocument();
  });
});
