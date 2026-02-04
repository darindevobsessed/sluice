import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useExtraction } from '../useExtraction';
import type { AgentConnection } from '@/lib/agent/connection';
import type { ExtractionResult } from '@/lib/claude/prompts/types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock agent connection
const createMockAgent = () => {
  const mockAgent: Partial<AgentConnection> = {
    generateInsight: vi.fn(),
    cancelInsight: vi.fn(),
  };
  return mockAgent as AgentConnection;
};

describe('useExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('initial state', () => {
    it('should start in idle state when no agent provided', () => {
      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test transcript' },
        agent: null,
      }));

      expect(result.current.state.overall).toBe('idle');
      expect(result.current.state.partial).toEqual({});
      expect(result.current.state.error).toBeNull();
    });

    it('should load existing extraction on mount', async () => {
      const existingExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: {
          tldr: 'Existing summary',
          overview: 'Existing overview',
          keyPoints: ['Point 1'],
        },
        insights: [],
        actionItems: {
          immediate: [],
          shortTerm: [],
          longTerm: [],
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
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extraction: existingExtraction, generatedAt: '2024-01-01T00:00:00Z' }),
      });

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: null,
      }));

      await waitFor(() => {
        expect(result.current.state.overall).toBe('done');
      });

      expect(result.current.state.partial.contentType).toBe('dev');
      expect(result.current.state.partial.summary?.tldr).toBe('Existing summary');
    });
  });

  describe('extraction flow', () => {
    it('should initiate extraction and update state on text events', async () => {
      const mockAgent = createMockAgent();
      let onTextCallback: ((text: string) => void) | undefined;

      (mockAgent.generateInsight as ReturnType<typeof vi.fn>).mockImplementation((_opts, callbacks) => {
        onTextCallback = callbacks.onText;
        callbacks.onStart?.();
        return 'test-id';
      });

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: mockAgent,
      }));

      act(() => {
        result.current.extract();
      });

      expect(result.current.state.overall).toBe('extracting');
      expect(result.current.insightId).toBe('test-id');

      // Simulate text streaming with just contentType
      act(() => {
        onTextCallback?.('{"contentType": "dev"');
      });

      // When contentType is extracted, summary section goes to 'working'
      expect(result.current.state.sections.summary).toBe('working');
    });

    it('should update section statuses progressively as sections complete', async () => {
      const mockAgent = createMockAgent();
      let onTextCallback: ((text: string) => void) | undefined;

      (mockAgent.generateInsight as ReturnType<typeof vi.fn>).mockImplementation((_opts, callbacks) => {
        onTextCallback = callbacks.onText;
        callbacks.onStart?.();
        return 'test-id';
      });

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: mockAgent,
      }));

      act(() => {
        result.current.extract();
      });

      // Stream partial with summary complete
      act(() => {
        onTextCallback?.(JSON.stringify({
          contentType: 'dev',
          summary: {
            tldr: 'Summary',
            overview: 'Overview',
            keyPoints: ['Key 1'],
          },
        }));
      });

      expect(result.current.state.sections.summary).toBe('done');
      expect(result.current.state.sections.insights).toBe('working');
    });

    it('should persist extraction on done event', async () => {
      const mockAgent = createMockAgent();
      let onDoneCallback: ((fullContent: string) => void) | undefined;

      (mockAgent.generateInsight as ReturnType<typeof vi.fn>).mockImplementation((_opts, callbacks) => {
        onDoneCallback = callbacks.onDone;
        callbacks.onStart?.();
        return 'test-id';
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ extraction: {}, generatedAt: '2024-01-01T00:00:00Z' }),
      });

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: mockAgent,
      }));

      act(() => {
        result.current.extract();
      });

      const fullExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: { tldr: 'Test', overview: 'Test', keyPoints: [] },
        insights: [],
        actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
        claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
      };

      act(() => {
        onDoneCallback?.(JSON.stringify(fullExtraction));
      });

      await waitFor(() => {
        expect(result.current.state.overall).toBe('done');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/videos/1/insights',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ extraction: fullExtraction }),
        })
      );
    });

    it('should handle errors during extraction', async () => {
      const mockAgent = createMockAgent();
      let onErrorCallback: ((error: string) => void) | undefined;

      (mockAgent.generateInsight as ReturnType<typeof vi.fn>).mockImplementation((_opts, callbacks) => {
        onErrorCallback = callbacks.onError;
        callbacks.onStart?.();
        return 'test-id';
      });

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: mockAgent,
      }));

      act(() => {
        result.current.extract();
      });

      act(() => {
        onErrorCallback?.('Test error');
      });

      expect(result.current.state.overall).toBe('error');
      expect(result.current.state.error).toBe('Test error');
    });

    it('should handle cancel', async () => {
      const mockAgent = createMockAgent();
      let onCancelCallback: (() => void) | undefined;

      (mockAgent.generateInsight as ReturnType<typeof vi.fn>).mockImplementation((_opts, callbacks) => {
        onCancelCallback = callbacks.onCancel;
        callbacks.onStart?.();
        return 'test-id';
      });

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: mockAgent,
      }));

      act(() => {
        result.current.extract();
      });

      expect(result.current.state.overall).toBe('extracting');

      act(() => {
        result.current.cancel();
      });

      expect(mockAgent.cancelInsight).toHaveBeenCalledWith('test-id');

      act(() => {
        onCancelCallback?.();
      });

      expect(result.current.state.overall).toBe('idle');
    });
  });

  describe('edge cases', () => {
    it('should not extract when agent is null', () => {
      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: null,
      }));

      act(() => {
        result.current.extract();
      });

      expect(result.current.state.overall).toBe('idle');
    });

    it('should not extract when already extracting', () => {
      const mockAgent = createMockAgent();
      (mockAgent.generateInsight as ReturnType<typeof vi.fn>).mockImplementation((_opts, callbacks) => {
        callbacks.onStart?.();
        return 'test-id';
      });

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: mockAgent,
      }));

      act(() => {
        result.current.extract();
      });

      const firstId = result.current.insightId;

      act(() => {
        result.current.extract();
      });

      // Should still be the same insight ID
      expect(result.current.insightId).toBe(firstId);
      expect(mockAgent.generateInsight).toHaveBeenCalledTimes(1);
    });

    it('should handle failed API persistence gracefully', async () => {
      const mockAgent = createMockAgent();
      let onDoneCallback: ((fullContent: string) => void) | undefined;

      (mockAgent.generateInsight as ReturnType<typeof vi.fn>).mockImplementation((_opts, callbacks) => {
        onDoneCallback = callbacks.onDone;
        callbacks.onStart?.();
        return 'test-id';
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useExtraction({
        videoId: 1,
        video: { title: 'Test', channel: 'Test', transcript: 'Test' },
        agent: mockAgent,
      }));

      act(() => {
        result.current.extract();
      });

      const fullExtraction: ExtractionResult = {
        contentType: 'dev',
        summary: { tldr: 'Test', overview: 'Test', keyPoints: [] },
        insights: [],
        actionItems: { immediate: [], shortTerm: [], longTerm: [], resources: [] },
        claudeCode: { applicable: false, skills: [], commands: [], agents: [], hooks: [], rules: [] },
      };

      act(() => {
        onDoneCallback?.(JSON.stringify(fullExtraction));
      });

      await waitFor(() => {
        expect(result.current.state.overall).toBe('done');
      });

      // Extraction should still be in state even if persistence failed
      expect(result.current.state.partial.contentType).toBe('dev');
    });
  });
});
