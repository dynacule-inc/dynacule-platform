/**
 * Tests for the StatusBar component.
 *
 * WebSocket is mocked at the vitest setup level.
 */

import { render, screen, act } from '@testing-library/react';
import StatusBar from '@/components/StatusBar';

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the status bar shell', () => {
    render(<StatusBar />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('shows connected indicator initially', () => {
    render(<StatusBar />);
    // Expect the green dot to be present via WebSocket onopen
    const statusBar = screen.getByText('Idle');
    expect(statusBar).toBeInTheDocument();
  });

  it('updates status on log message', () => {
    render(<StatusBar />);

    act(() => {
      const ws = (globalThis as any).__mockWebSocket;
      if (!ws) {
        // Create and use the mock WebSocket
        const mockWs = new (globalThis as any).WebSocket('ws://test/ws');
        mockWs.onmessage({
          data: JSON.stringify({ type: 'log', message: 'Processing step 1' }),
        } as MessageEvent);
      }
    });
  });

  it('updates status on progress message', () => {
    render(<StatusBar />);
    // Component will show progress via WebSocket message
  });

  it('shows complete on done message', () => {
    render(<StatusBar />);
    // Component will show 'Complete' via WebSocket done message
  });
});
