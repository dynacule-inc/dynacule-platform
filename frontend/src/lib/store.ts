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

export type ViewPreset = 'dynacule' | 'cartoon' | 'ribbon' | 'surface' | 'cpk' | 'backbone';

export interface VizCommand {
  type: 'clear' | 'docking' | 'md' | 'qm';
  /** PDB data for docking ligand or MD trajectory (multi-model PDB) */
  pdbData?: string;
  /** Number of frames for MD trajectory */
  numFrames?: number;
  /** Label for the overlay */
  label?: string;
  /** Energy data for QM results */
  energyData?: { label: string; value: number; unit: string }[];
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

  // Results visualization state
  vizCommand: VizCommand | null;
  trajFrame: number;
  setVizCommand: (cmd: VizCommand | null) => void;
  setTrajFrame: (frame: number) => void;

  // Atom picking state
  selectedAtom: AtomSelection | null;
  setSelectedAtom: (atom: AtomSelection | null) => void;

  // View preset state
  viewPreset: ViewPreset;
  setViewPreset: (preset: ViewPreset) => void;
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

  // Results visualization
  vizCommand: null,
  trajFrame: 0,
  setVizCommand: (vizCommand) => set({ vizCommand, trajFrame: 0 }),
  setTrajFrame: (trajFrame) => set({ trajFrame }),

  // Atom picking
  selectedAtom: null,
  setSelectedAtom: (selectedAtom) => set({ selectedAtom }),

  // View preset
  viewPreset: 'dynacule',
  setViewPreset: (viewPreset) => set({ viewPreset }),
}));