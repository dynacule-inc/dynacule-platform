import { create } from 'zustand';
import type { MoleculeData } from '@/lib/moleculeApi';
import type { JobSummary, JobStats } from '@/lib/jobApi';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

interface AtomSelection {
  index: number;
  serial: number;
  name: string;
  element: string;
  x: number;
  y: number;
  z: number;
}

interface State {
  // Project state
  projects: Project[];
  selectedProjectId: string | null;
  setProjects: (projects: Project[]) => void;
  setSelectedProjectId: (id: string | null) => void;

  // Molecule state
  molecules: MoleculeData[];
  selectedMolecule: MoleculeData | null;
  setMolecules: (molecules: MoleculeData[]) => void;
  setSelectedMolecule: (mol: MoleculeData | null) => void;

  // Job monitoring state
  jobs: JobSummary[];
  jobStats: JobStats | null;
  selectedJob: JobSummary | null;
  setJobs: (jobs: JobSummary[]) => void;
  addOrUpdateJob: (job: JobSummary) => void;
  setJobStats: (stats: JobStats | null) => void;
  setSelectedJob: (job: JobSummary | null) => void;

  // Atom picking state
  selectedAtom: AtomSelection | null;
  setSelectedAtom: (atom: AtomSelection | null) => void;
}

export const useStore = create<State>((set) => ({
  // Projects
  projects: [],
  selectedProjectId: null,
  setProjects: (projects) => set({ projects }),
  setSelectedProjectId: (selectedProjectId) => {
    set({ selectedProjectId });
  },

  // Molecules
  molecules: [],
  selectedMolecule: null,
  setMolecules: (molecules) => set({ molecules }),
  setSelectedMolecule: (selectedMolecule) => {
    set({ selectedMolecule });
  },

  // Jobs
  jobs: [],
  jobStats: null,
  selectedJob: null,
  setJobs: (jobs) => set({ jobs }),
  addOrUpdateJob: (job) =>
    set((state) => {
      const existing = state.jobs.findIndex((j) => j.id === job.id);
      if (existing >= 0) {
        const updated = [...state.jobs];
        updated[existing] = { ...updated[existing], ...job };
        return { jobs: updated };
      }
      return { jobs: [job, ...state.jobs] };
    }),
  setJobStats: (jobStats) => set({ jobStats }),
  setSelectedJob: (selectedJob) => set({ selectedJob }),

  // Atom picking
  selectedAtom: null,
  setSelectedAtom: (selectedAtom) => set({ selectedAtom }),
}));