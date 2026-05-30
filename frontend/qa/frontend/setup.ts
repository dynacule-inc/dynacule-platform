import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Polyfill ResizeObserver — used by cmdk, not available in jsdom
// ---------------------------------------------------------------------------
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

// ---------------------------------------------------------------------------
// Mock NGL — MolecularViewer uses dynamic import('ngl') inside useEffect
// ---------------------------------------------------------------------------
const mockSignals = {
  clicked: {
    add: vi.fn(),
    remove: vi.fn(),
  },
};

const mockStage = vi.fn().mockImplementation(() => ({
  loadFile: vi.fn().mockResolvedValue(undefined),
  autoView: vi.fn(),
  dispose: vi.fn(),
  signals: mockSignals,
  eachComponent: vi.fn(),
  removeComponent: vi.fn(),
  addComponentFromObject: vi.fn().mockReturnValue({
    addRepresentation: vi.fn(),
    name: '',
  }),
}));

const mockShape = vi.fn().mockImplementation(() => ({
  addSphere: vi.fn(),
}));

vi.mock('ngl', () => ({
  Stage: mockStage,
  Shape: mockShape,
  default: { Stage: mockStage, Shape: mockShape },
}));

// ---------------------------------------------------------------------------
// Mock next/navigation — available for any future dependency
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: vi.fn().mockReturnValue('/'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));