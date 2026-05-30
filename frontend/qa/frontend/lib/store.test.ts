import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/lib/store';
import { act } from '@testing-library/react';

describe('useStore (zustand)', () => {
  // Reset the store before each test by resetting to initial state
  beforeEach(() => {
    act(() => {
      useStore.setState({
        projects: [],
        selectedProjectId: null,
      });
    });
  });

  it('starts with empty projects and null selectedProjectId', () => {
    const state = useStore.getState();
    expect(state.projects).toEqual([]);
    expect(state.selectedProjectId).toBeNull();
  });

  it('setProjects replaces the projects array', () => {
    const sample = [
      { id: '1', name: 'Alpha', description: 'First project' },
      { id: '2', name: 'Beta' },
    ];

    act(() => {
      useStore.getState().setProjects(sample);
    });

    const state = useStore.getState();
    expect(state.projects).toHaveLength(2);
    expect(state.projects[0].name).toBe('Alpha');
    expect(state.projects[1].name).toBe('Beta');
  });

  it('setSelectedProjectId updates the id', () => {
    act(() => {
      useStore.getState().setSelectedProjectId('42');
    });

    expect(useStore.getState().selectedProjectId).toBe('42');

    act(() => {
      useStore.getState().setSelectedProjectId(null);
    });

    expect(useStore.getState().selectedProjectId).toBeNull();
  });
});