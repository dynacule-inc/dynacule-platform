import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MolecularViewer from '@/components/MolecularViewer';

let mockSelectedAtom: any = null;
const mockSetSelectedAtom = vi.fn();

vi.mock('@/lib/store', () => ({
  useStore: (selector?: any) => {
    const state = {
      projects: [],
      selectedProjectId: null,
      selectedAtom: mockSelectedAtom,
      setSelectedAtom: mockSetSelectedAtom,
      setProjects: vi.fn(),
      setSelectedProjectId: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

describe('MolecularViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedAtom = null;
  });

  it('renders the container div', () => {
    const { container } = render(<MolecularViewer />);
    const viewerDiv = container.firstChild as HTMLElement;
    expect(viewerDiv).toBeInTheDocument();
  });

  it('renders picking mode buttons when NGL stage is ready', async () => {
    render(<MolecularViewer />);

    await waitFor(() => {
      expect(screen.getByText('Dist')).toBeInTheDocument();
      expect(screen.getByText('Angle')).toBeInTheDocument();
      expect(screen.getByText('Torsion')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });
  });

  it('highlights Dist button when distance mode is active', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MolecularViewer />);

    await waitFor(() => {
      expect(screen.getByText('Dist')).toBeInTheDocument();
    });

    await user.setup().click(screen.getByText('Dist'));

    const distBtn = screen.getByText('Dist');
    expect(distBtn.className).toContain('amber');
  });

  it('highlights Angle button when angle mode is active', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MolecularViewer />);

    await waitFor(() => {
      expect(screen.getByText('Angle')).toBeInTheDocument();
    });

    await user.setup().click(screen.getByText('Angle'));

    const angleBtn = screen.getByText('Angle');
    expect(angleBtn.className).toContain('amber');
  });

  it('highlights Torsion button when torsion mode is active', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MolecularViewer />);

    await waitFor(() => {
      expect(screen.getByText('Torsion')).toBeInTheDocument();
    });

    await user.setup().click(screen.getByText('Torsion'));

    const torsionBtn = screen.getByText('Torsion');
    expect(torsionBtn.className).toContain('amber');
  });

  it('shows picking mode label when a mode is active', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MolecularViewer />);

    await waitFor(() => {
      expect(screen.getByText('Dist')).toBeInTheDocument();
    });

    await user.setup().click(screen.getByText('Dist'));

    expect(screen.getByText(/picking: distance/i)).toBeInTheDocument();
  });

  it('resets picking mode on Reset button click', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MolecularViewer />);

    await waitFor(() => {
      expect(screen.getByText('Dist')).toBeInTheDocument();
    });

    // Activate distance mode
    await user.setup().click(screen.getByText('Dist'));
    expect(screen.getByText(/picking: distance/i)).toBeInTheDocument();

    // Reset
    await user.setup().click(screen.getByText('Reset'));
    expect(screen.queryByText(/picking:/i)).not.toBeInTheDocument();
  });

  it('passes className prop to the container', () => {
    const { container } = render(<MolecularViewer className="custom-class" />);
    const viewerDiv = container.firstChild as HTMLElement;
    expect(viewerDiv.className).toContain('custom-class');
  });

  it('marks non-active buttons with the navy/cream style', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MolecularViewer />);

    await waitFor(() => {
      expect(screen.getByText('Dist')).toBeInTheDocument();
    });

    // Activate Angle mode; Dist should no longer be active
    await user.setup().click(screen.getByText('Angle'));

    const distBtn = screen.getByText('Dist');
    expect(distBtn.className).not.toContain('amber');
  });
});