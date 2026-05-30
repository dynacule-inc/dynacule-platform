/**
 * Tests for the Project API client (lib/projectApi.ts).
 */

import { projectApi } from '@/lib/projectApi';

describe('ProjectApiService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches projects and maps ids to strings', async () => {
    const mockResponse = [
      { id: 1, name: 'Alpha', description: 'First project' },
      { id: 2, name: 'Beta' },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const projects = await projectApi.fetchProjects();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/projects/')
    );
    expect(projects).toHaveLength(2);
    expect(projects[0].id).toBe('1');
    expect(projects[0].name).toBe('Alpha');
    expect(projects[1].id).toBe('2');
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(projectApi.fetchProjects()).rejects.toThrow('Fetch projects failed: 500');
  });

  it('handles empty response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const projects = await projectApi.fetchProjects();
    expect(projects).toEqual([]);
  });

  it('handles network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(projectApi.fetchProjects()).rejects.toThrow('Network error');
  });
});