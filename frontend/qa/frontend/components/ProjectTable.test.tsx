import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectTable from '@/components/ProjectTable';

const mockSetProjects = vi.fn();
const mockSetSelectedProjectId = vi.fn();

let mockProjects: any[] = [];

vi.mock('@/lib/store', () => ({
  useStore: (selector?: any) => {
    const state = {
      projects: mockProjects,
      setProjects: mockSetProjects,
      setSelectedProjectId: mockSetSelectedProjectId,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/lib/projectApi', () => ({
  projectApi: {
    fetchProjects: vi.fn(),
  },
}));

import { projectApi } from '@/lib/projectApi';

describe('ProjectTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects = [];
  });

  it('shows empty state when no projects exist', async () => {
    const mockFetch = vi.mocked(projectApi.fetchProjects);
    mockFetch.mockResolvedValue([]);

    render(<ProjectTable />);

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });

  it('fetches projects on mount and renders them', async () => {
    const mockFetch = vi.mocked(projectApi.fetchProjects);
    mockFetch.mockResolvedValue([
      { id: '1', name: 'Alpha', description: 'First project' },
      { id: '2', name: 'Beta' },
    ]);

    // Set mock projects to simulate the store update
    mockProjects = [
      { id: '1', name: 'Alpha', description: 'First project' },
      { id: '2', name: 'Beta' },
    ];

    render(<ProjectTable />);

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('First project')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('calls fetchProjects on mount', async () => {
    const mockFetch = vi.mocked(projectApi.fetchProjects);
    mockFetch.mockResolvedValue([]);

    render(<ProjectTable />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('sets selectedProjectId when a project is clicked', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.mocked(projectApi.fetchProjects);
    mockFetch.mockResolvedValue([
      { id: '1', name: 'Alpha', description: 'First project' },
    ]);

    mockProjects = [
      { id: '1', name: 'Alpha', description: 'First project' },
    ];

    render(<ProjectTable />);

    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Alpha'));

    expect(mockSetSelectedProjectId).toHaveBeenCalledWith('1');
  });

  it('handles fetch error gracefully', async () => {
    const mockFetch = vi.mocked(projectApi.fetchProjects);
    mockFetch.mockRejectedValue(new Error('API error'));

    // Suppress console.error for this expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ProjectTable />);

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('renders the Projects heading', () => {
    render(<ProjectTable />);
    expect(screen.getByRole('heading', { name: /projects/i })).toBeInTheDocument();
  });
});