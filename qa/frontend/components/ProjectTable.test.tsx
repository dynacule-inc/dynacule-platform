/**
 * Tests for the ProjectTable component.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectTable from '@/components/ProjectTable';
import { useStore } from '@/lib/store';

const mockSetProjects = vi.fn();
const mockSetSelectedProjectId = vi.fn();
const mockFetchProjects = vi.fn();

vi.mock('@/lib/store', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      projects: [],
      selectedProjectId: null,
      setProjects: mockSetProjects,
      setSelectedProjectId: mockSetSelectedProjectId,
    };
    return selector(state);
  }),
}));

vi.mock('@/lib/projectApi', () => ({
  projectApi: {
    fetchProjects: () => mockFetchProjects(),
  },
}));

describe('ProjectTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({ projects: [], selectedProjectId: null });
  });

  it('shows empty state when no projects', () => {
    mockFetchProjects.mockResolvedValue([]);
    render(<ProjectTable />);
    expect(screen.getByText('No projects yet.')).toBeInTheDocument();
  });

  it('renders project names when fetched', async () => {
    mockFetchProjects.mockResolvedValue([
      { id: '1', name: 'Alpha', description: 'First' },
      { id: '2', name: 'Beta' },
    ]);

    render(<ProjectTable />);

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('selects project on click', async () => {
    mockFetchProjects.mockResolvedValue([
      { id: '42', name: 'Selected Project' },
    ]);

    render(<ProjectTable />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Selected Project'));
    });

    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('42');
  });

  it('shows project descriptions', async () => {
    mockFetchProjects.mockResolvedValue([
      { id: '1', name: 'Test', description: 'Test description' },
    ]);

    render(<ProjectTable />);

    await waitFor(() => {
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });
  });
});