import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import StatusBar from '@/components/StatusBar';

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readyState: number = 0;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.readyState = 3;
  }

  // Test helpers
  triggerOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  triggerMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  triggerClose() {
    this.readyState = 3;
    this.onclose?.();
  }

  triggerError() {
    this.onerror?.();
  }
}

let mockWsInstance: MockWebSocket;

describe('StatusBar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'WebSocket',
      vi.fn((url: string) => {
        mockWsInstance = new MockWebSocket(url);
        return mockWsInstance;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the status bar container', () => {
    render(<StatusBar />);
    // Should show "Idle" as initial status
    expect(screen.getByText(/idle/i)).toBeInTheDocument();
  });

  it('shows connected indicator when WebSocket opens', () => {
    render(<StatusBar />);
    act(() => {
      mockWsInstance.triggerOpen();
    });

    // The green dot should be present — query by the connected class
    const statusDot = screen.getByText(/idle/i).previousElementSibling;
    expect(statusDot).toHaveClass('bg-green-400');
  });

  it('shows disconnected indicator when WebSocket closes', () => {
    render(<StatusBar />);
    act(() => {
      mockWsInstance.triggerOpen();
    });
    act(() => {
      mockWsInstance.triggerClose();
    });

    const statusDot = screen.getByText(/idle/i).previousElementSibling;
    expect(statusDot).toHaveClass('bg-red-400');
  });

  it('shows disconnected indicator on WebSocket error', () => {
    render(<StatusBar />);
    act(() => {
      mockWsInstance.triggerError();
    });

    const statusDot = screen.getByText(/idle/i).previousElementSibling;
    expect(statusDot).toHaveClass('bg-red-400');
  });

  it('updates status on log messages', () => {
    render(<StatusBar />);
    act(() => {
      mockWsInstance.triggerMessage(JSON.stringify({ type: 'log', message: 'Docking started' }));
    });

    expect(screen.getByText(/docking started/i)).toBeInTheDocument();
  });

  it('updates status on progress messages', () => {
    render(<StatusBar />);
    act(() => {
      mockWsInstance.triggerMessage(JSON.stringify({ type: 'progress', message: 'Minimizing', current: 5, total: 10 }));
    });

    expect(screen.getByText(/minimizing.*5.*10/i)).toBeInTheDocument();
  });

  it('shows Complete on done messages', () => {
    render(<StatusBar />);
    act(() => {
      mockWsInstance.triggerMessage(JSON.stringify({ type: 'done' }));
    });

    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });

  it('handles plain text (non-JSON) messages', () => {
    render(<StatusBar />);
    act(() => {
      mockWsInstance.triggerMessage('Status update text');
    });

    expect(screen.getByText(/status update text/i)).toBeInTheDocument();
  });

  it('closes WebSocket on unmount', () => {
    const closeSpy = vi.spyOn(MockWebSocket.prototype, 'close');
    const { unmount } = render(<StatusBar />);

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});