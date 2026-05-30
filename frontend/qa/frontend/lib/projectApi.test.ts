import { describe, it, expect, beforeEach, vi } from 'vitest';
import { projectApi } from '@/lib/projectApi';

describe('projectApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchProjects returns mapped projects on success', async () => {
    const raw = [
      { id: 1, name: 'Alpha', description: 'First', created_at: '2025-01-01' },
      { id: 2, name: 'Beta' },
    ];

    // Mock a successful fetch response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(raw),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await projectApi.fetchProjects();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: '1',
      name: 'Alpha',
      description: 'First',
      created_at: '2025-01-01',
    });
    expect(result[1]).toEqual({
      id: '2',
      name: 'Beta',
      description: undefined,
      created_at: undefined,
    });

    // Verify the URL includes the expected path
    const callUrl = mockFetch.mock.calls[0][0] as string;
    expect(callUrl).toContain('/projects/');
  });

  it('fetchProjects throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(projectApi.fetchProjects()).rejects.toThrow(
      'Fetch projects failed: 500',
    );
  });

  it('fetchProjects propagates network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure')),
    );

    await expect(projectApi.fetchProjects()).rejects.toThrow('Network failure');
  });
});