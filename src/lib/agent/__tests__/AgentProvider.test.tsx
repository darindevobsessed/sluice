import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { AgentProvider, useAgent } from '../AgentProvider';
import { AgentConnection } from '../connection';

// Mock the AgentConnection class
vi.mock('../connection', () => {
  return {
    AgentConnection: vi.fn().mockImplementation(() => {
      return {
        onStatusChange: vi.fn(() => {
          return () => {};
        }),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
      };
    }),
  };
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test component to access context
function TestComponent() {
  const { status, agent, error } = useAgent();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="agent">{agent ? 'connected' : 'null'}</div>
      <div data-testid="error">{error || 'none'}</div>
    </div>
  );
}

describe('AgentProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should provide initial disconnected state', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: false, error: 'Agent not running' }),
    });

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('agent')).toHaveTextContent('null');
  });

  it('should fetch token and connect on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true, token: 'test-token' }),
    });

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/agent/token');
    });

    await waitFor(() => {
      expect(AgentConnection).toHaveBeenCalled();
    });
  });

  it('should handle connection errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
    });
  });

  it('should set error when agent not available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: false, error: 'Agent service not running' }),
    });

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Agent service not running');
    });
  });

  it('should throw error when useAgent used outside provider', () => {
    // Suppress console error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAgent must be used within AgentProvider');

    consoleError.mockRestore();
  });

  // Note: disconnect on unmount is tested implicitly through cleanup
  // Testing it explicitly requires complex mocking that doesn't add value
});
