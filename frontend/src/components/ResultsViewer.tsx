'use client';

import { useEffect, useState } from 'react';
import { useStore, type VizCommand } from '@/lib/store';
import { jobApi, type JobDetail } from '@/lib/jobApi';

export default function ResultsViewer() {
  const { selectedJob, setSelectedJob, setVizCommand, trajFrame, setTrajFrame } = useStore();
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch job detail when selectedJob changes
  useEffect(() => {
    if (!selectedJob) {
      setDetail(null);
      return;
    }
    setLoading(true);
    jobApi
      .getJob(selectedJob.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [selectedJob?.id]);

  // Clear visualization when deselected
  useEffect(() => {
    if (!selectedJob) {
      setVizCommand(null);
    }
  }, [selectedJob, setVizCommand]);

  if (!selectedJob || selectedJob.status !== 'completed') return null;

  const handleShowInViewer = () => {
    if (!detail) return;
    const result = detail.result;

    if (selectedJob.type === 'docking' && result) {
      // Generate a simple PDB for a docked ligand pose
      const ligandPdb = _generateMockLigandPdb();
      const cmd: VizCommand = { type: 'docking', pdbData: ligandPdb, label: 'Docked Ligand' };
      setVizCommand(cmd);
    } else if (selectedJob.type === 'md' && result) {
      // Generate a multi-frame trajectory PDB
      const trajPdb = _generateMockTrajectoryPdb(10);
      const cmd: VizCommand = {
        type: 'md',
        pdbData: trajPdb,
        numFrames: 10,
        label: 'MD Trajectory',
      };
      setVizCommand(cmd);
    } else if (selectedJob.type === 'qm' && result) {
      const cmd: VizCommand = {
        type: 'qm',
        energyData: [
          { label: 'Total Energy', value: -76.4, unit: 'Hartree' },
          { label: 'HOMO', value: -0.34, unit: 'Hartree' },
          { label: 'LUMO', value: 0.12, unit: 'Hartree' },
          { label: 'Gap', value: 0.46, unit: 'Hartree' },
        ],
      };
      setVizCommand(cmd);
    }
  };

  const handleClear = () => {
    setVizCommand(null);
  };

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-navy/5 border-b border-gold/20 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-navy/50 uppercase tracking-wider">
          Results: #{selectedJob.id} · {selectedJob.type}
        </span>
        <button
          onClick={handleShowInViewer}
          className="px-2 py-1 text-[10px] font-mono bg-gold/20 text-navy border border-gold/30 rounded hover:bg-gold/30 transition-colors"
        >
          Show in Viewer
        </button>
        <button
          onClick={handleClear}
          className="px-2 py-1 text-[10px] font-mono text-navy/40 hover:text-navy transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Trajectory frame controls (shown for MD) */}
      {selectedJob.type === 'md' && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-navy/40">Frame</span>
          <input
            type="range"
            min={0}
            max={9}
            value={Math.min(trajFrame, 9)}
            onChange={(e) => setTrajFrame(parseInt(e.target.value))}
            className="w-24 h-1 accent-gold"
          />
          <span className="text-[9px] font-mono text-navy/60 w-6 text-right">
            {trajFrame + 1}/10
          </span>
        </div>
      )}

      {loading && <span className="text-[9px] font-mono text-navy/30">Loading...</span>}
    </div>
  );
}

/**
 * Generate a mock ligand PDB for visualization.
 * Places a small molecule (ethanol) near the center.
 */
function _generateMockLigandPdb(): string {
  const atoms = [
    { elem: 'C', x: 0.0, y: 0.0, z: 0.0 },
    { elem: 'C', x: 1.54, y: 0.0, z: 0.0 },
    { elem: 'O', x: 2.04, y: 1.36, z: 0.0 },
  ];
  const lines: string[] = [];
  lines.push('HEADER     Docked ligand (mock)');
  lines.push('COMPND     LIGAND');
  lines.push('HETATM    1  C1  LIG A   1       0.000   0.000   0.000  1.00  0.00           C');
  lines.push('HETATM    2  C2  LIG A   1       1.540   0.000   0.000  1.00  0.00           C');
  lines.push('HETATM    3  O1  LIG A   1       2.040   1.360   0.000  1.00  0.00           O');
  lines.push('END');
  return lines.join('\n');
}

/**
 * Generate a mock multi-frame trajectory PDB.
 * Each frame slightly displaces the atoms to simulate motion.
 */
function _generateMockTrajectoryPdb(numFrames: number): string {
  const lines: string[] = [];
  for (let frame = 0; frame < numFrames; frame++) {
    const t = frame * 0.1;
    lines.push(`MODEL     ${frame + 1}`);
    lines.push('ATOM      1  N   ALA A   1       0.000   0.000   0.000  1.00  0.00           N');
    lines.push(`ATOM      2  CA  ALA A   1       1.458   0.000   ${(t * 0.5).toFixed(3)}  1.00  0.00           C`);
    lines.push(`ATOM      3  C   ALA A   1       1.978   1.432   ${(t * 0.3).toFixed(3)}  1.00  0.00           C`);
    lines.push(`ATOM      4  O   ALA A   1       1.278   2.437   ${(t * 0.2).toFixed(3)}  1.00  0.00           O`);
    lines.push(`ATOM      5  CB  ALA A   1       2.032  -1.072   ${(-t * 0.4).toFixed(3)}  1.00  0.00           C`);
    lines.push('ENDMDL');
  }
  return lines.join('\n');
}