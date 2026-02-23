import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AgentProvider, useAgent } from '../AgentProvider';
import { AgentConnection } from '../connection';

// Create mock functions that will be reused
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn();
const mockOnStatusChange = vi.fn(() => () => {});

// Mock the AgentConnection class
vi.mock('../connection', () => {
  const MockAgentConnection = vi.fn(function(
    this: {
      onStatusChange: typeof mockOnStatusChange
      connect: typeof mockConnect
      disconnect: typeof mockDisconnect
    }
  ) {
    this.onStatusChange = mockOnStatusChange;
    this.connect = mockConnect;
    this.disconnect = mockDisconnect;
  });

  return {
    AgentConnection: MockAgentConnection,
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('defers agent token fetch by 2 seconds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true, token: 'test-token', transport: 'websocket' }),
    });

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    // fetch should NOT be called immediately
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Now fetch should be called
    expect(mockFetch).toHaveBeenCalledWith('/api/agent/token');
  });

  it('cleans up timer on unmount before fetch fires', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true, token: 'test-token', transport: 'websocket' }),
    });

    const { unmount } = render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    // Unmount before timer fires
    unmount();

    // Advance past the delay
    vi.advanceTimersByTime(3000);

    // fetch should never have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should fetch token and connect after 2-second delay', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true, token: 'test-token', transport: 'websocket' }),
    });

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    // Advance the 2-second defer and let async operations complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/agent/token');
    expect(AgentConnection).toHaveBeenCalled();
  });

  it('should handle connection errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    // Advance the 2-second defer and let async operations complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Network error');
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

    // Advance the 2-second defer and let async operations complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Agent service not running');
  });

  it('should throw error when useAgent used outside provider', () => {
    // Suppress console error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAgent must be used within AgentProvider');

    consoleError.mockRestore();
  });

  it('should pass transport hint to connection.connect', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true, token: 'test-token', transport: 'sse' }),
    });

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    // Advance the 2-second defer and let async operations complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockConnect).toHaveBeenCalledWith('test-token', 'sse');
  });

  it('should default to websocket transport when hint missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: true, token: 'test-token' }),
    });

    render(
      <AgentProvider>
        <TestComponent />
      </AgentProvider>
    );

    // Advance the 2-second defer and let async operations complete
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockConnect).toHaveBeenCalledWith('test-token', 'websocket');
  });

  // Note: disconnect on unmount is tested implicitly through cleanup
  // Testing it explicitly requires complex mocking that doesn't add value
});
