/**
 * React context provider for agent connection.
 * Auto-connects to the local agent WebSocket on mount.
 */
'use client';

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { AgentConnection, type ConnectionStatus, type TransportMode } from './connection';

interface AgentContextValue {
  status: ConnectionStatus;
  agent: AgentConnection | null;
  error: string | null;
}

const AgentContext = createContext<AgentContextValue | null>(null);

interface AgentProviderProps {
  children: ReactNode;
}

/**
 * Provides agent connection to the app.
 * Automatically fetches token and connects to the local agent WebSocket.
 */
export function AgentProvider({ children }: AgentProviderProps) {
  const [agent, setAgent] = useState<AgentConnection | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<AgentConnection | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch('/api/agent/token');
        const data = await res.json();

        if (!data.available || cancelled) {
          setError(data.error || 'Agent not available');
          return;
        }

        const transport: TransportMode = data.transport || 'websocket';

        const connection = new AgentConnection();
        connectionRef.current = connection;
        connection.onStatusChange(setStatus);

        await connection.connect(data.token, transport);
        if (!cancelled) {
          setAgent(connection);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Connection failed');
        }
      }
    }

    // Defer agent connection — not needed for initial page render.
    // This avoids triggering /api/agent/token compilation during the
    // initial API waterfall, letting page-critical routes compile first.
    const timer = setTimeout(connect, 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      connectionRef.current?.disconnect();
    };
  }, []);

  return (
    <AgentContext.Provider value={{ status, agent, error }}>
      {children}
    </AgentContext.Provider>
  );
}

/**
 * Hook to access agent connection from components
 */
export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return ctx;
}
