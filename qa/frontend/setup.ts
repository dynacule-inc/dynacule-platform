/**
 * Vitest setup file for Dynacule frontend tests.
 *
 * Mocks browser APIs and heavy third-party modules (NGL, cmdk)
 * that are not available in jsdom.
 */

import '@testing-library/jest-dom';

// ── Mock WebSocket ───────────────────────────────────────────────────────
class MockWebSocket {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState: number = WebSocket.OPEN;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event('open'));
    }, 0);
  }

  send(data: string) {}
  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

Object.defineProperty(globalThis, 'WebSocket', {
  writable: true,
  value: MockWebSocket,
});

// ── Mock NGL ─────────────────────────────────────────────────────────────
vi.mock('ngl', () => {
  class MockStage {
    constructor(container: HTMLElement, options: any) {}
    loadFile = vi.fn().mockResolvedValue({});
    autoView = vi.fn();
    signals = { clicked: { add: vi.fn(), remove: vi.fn() } };
    eachComponent = vi.fn();
    removeComponent = vi.fn();
    dispose = vi.fn();
  }

  return {
    Stage: MockStage,
    Shape: class {
      addSphere = vi.fn();
    },
  };
});

// ── Mock cmdk ────────────────────────────────────────────────────────────
vi.mock('cmdk', () => ({
  Command: {
    Input: 'cmdk-input',
    List: 'cmdk-list',
    Item: 'cmdk-item',
    Group: 'cmdk-group',
    Empty: 'cmdk-empty',
  },
}));

Object.defineProperty(globalThis.Command, 'Input', {});
Object.defineProperty(globalThis.Command, 'List', {});
Object.defineProperty(globalThis.Command, 'Item', {});
Object.defineProperty(globalThis.Command, 'Group', {});
Object.defineProperty(globalThis.Command, 'Empty', {});
