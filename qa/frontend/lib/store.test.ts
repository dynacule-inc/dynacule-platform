/**
 * Tests for the Zustand store (lib/store.ts).
 */

import { useStore } from '@/lib/store';

describe('Store', () => {
  beforeEach(() => {
    // Reset store state between tests
    useStore.setState({ projects: [], selectedProjectId: null });
  });

  it('initializes with empty projects', () => {
    const { projects } = useStore.getState();
    expect(projects).toEqual([]);
  });

  it('initializes with null selectedProjectId', () => {
    const { selectedProjectId } = useStore.getState();
    expect(selectedProjectId).toBeNull();
  });

  it('setProjects replaces the projects array', () => {
    const testProjects = [
      { id: '1', name: 'Project A' },
      { id: '2', name: 'Project B' },
    ];
    useStore.getState().setProjects(testProjects);
    expect(useStore.getState().projects).toEqual(testProjects);
  });

  it('setSelectedProjectId updates the selected project id', () => {
    useStore.getState().setSelectedProjectId('42');
    expect(useStore.getState().selectedProjectId).toBe('42');
  });

  it('setSelectedProjectId accepts null to deselect', () => {
    useStore.getState().setSelectedProjectId('42');
    useStore.getState().setSelectedProjectId(null);
    expect(useStore.getState().selectedProjectId).toBeNull();
  });

  it('multiple state updates compose correctly', () => {
    const { setProjects, setSelectedProjectId } = useStore.getState();
    setProjects([{ id: '1', name: 'X' }]);
    setSelectedProjectId('1');
    const state = useStore.getState();
    expect(state.projects).toHaveLength(1);
    expect(state.selectedProjectId).toBe('1');
  });
});
