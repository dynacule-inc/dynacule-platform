'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { moleculeApi } from '@/lib/moleculeApi';

/* ------------------------------------------------------------------ */
/*  NGL Stage Component                                                */
/*  NGL requires WebGL — only runs in the browser. We use dynamic      */
/*  import so Next.js doesn't try to SSR it. The next.config.mjs      */
/*  marks it as a server external so the server build skips it too.    */
/* ------------------------------------------------------------------ */

interface MolecularViewerProps {
  className?: string;
  projectId?: string | null;
}

export default function MolecularViewer({ className, projectId }: MolecularViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);
  const [pickingMode, setPickingMode] = useState<'distance' | 'angle' | 'torsion' | null>(null);
  const [nglReady, setNglReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { selectedAtom, setSelectedAtom, selectedMolecule, vizCommand, setVizCommand, trajFrame } = useStore();
  const [loadStatus, setLoadStatus] = useState<string>('');
  const stageInitRef = useRef(false);

  /* ── Load NGL on mount (client-side only) ────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || stageInitRef.current) return;
    stageInitRef.current = true;
    let destroyed = false;

    const initNGL = async () => {
      try {
        const NGL = await import('ngl');

        if (destroyed || !containerRef.current) return;

        const stage = new NGL.Stage(containerRef.current, {
          backgroundColor: '#f9f7f4',
        });

        stageRef.current = stage;
        setNglReady(true);
      } catch (err) {
        setLoadError('NGL requires WebGL. Please use a modern browser.');
        console.warn('NGL load failed:', err);
      }
    };

    initNGL();

    return () => {
      destroyed = true;
      if (stageRef.current) {
        try { stageRef.current.dispose(); } catch { /* noop */ }
        stageRef.current = null;
      }
      setNglReady(false);
    };
  }, []);

  /* ── Apply the Dynacule ribbon preset to a loaded component ──────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyRibbonPreset = useCallback(async (component: any) => {
    // Remove auto-added default representations
    component.removeAllRepresentations();

    // Ribbon representation for the protein backbone
    component.addRepresentation('ribbon', {
      color: 'white',
      subdiv: 3,
      smoothSheet: true,
    });

    // Tube representation for the backbone tracing
    component.addRepresentation('tube', {
      color: 'white',
      radius: 0.15,
      subdiv: 3,
    });

    // Ball+stick for ligands/non-polymer — only if there are small molecules
    await component.autoView(300);
  }, []);

  /* ── Load molecule into viewer ────────────────────────────────────── */
  const loadMolecule = useCallback(async (molId: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    try {
      setLoadStatus('Loading...');
      const { pdb } = await moleculeApi.getPdb(molId);

      // Remove existing loaded components (keep the stage itself)
      stage.eachComponent((c: any) => {
        // Don't remove measurement components
        if (c.name?.startsWith('highlight-') || c.name === '__measurements__') return;
        stage.removeComponent(c);
      });

      // Load from PDB string via Blob
      const blob = new Blob([pdb], { type: 'text/plain' });
      const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });

      if (comp) {
        await applyRibbonPreset(comp);
      }

      setLoadStatus('');
    } catch (err) {
      console.warn('Failed to load molecule:', err);
      setLoadStatus('Load failed');
    }
  }, [applyRibbonPreset]);

  /* ── Watch for selected molecule changes ─────────────────────────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    loadMolecule(selectedMolecule.id);
  }, [selectedMolecule, nglReady, loadMolecule]);

  /* ── Visualization command handling (docking overlay, MD traj, QM) ── */
  const overlayRef = useRef<any>(null);
  const trajCompRef = useRef<any>(null);

  useEffect(() => {
    if (!nglReady || !stageRef.current) return;
    const stage = stageRef.current;

    if (!vizCommand) return;

    const handleCommand = async () => {
      try {
        if (vizCommand.type === 'clear' || vizCommand.type === 'qm') {
          // Remove overlay/trajectory components for clear or QM
          if (overlayRef.current) {
            try { stage.removeComponent(overlayRef.current); } catch {}
            overlayRef.current = null;
          }
          if (trajCompRef.current) {
            try { stage.removeComponent(trajCompRef.current); } catch {}
            trajCompRef.current = null;
          }
          setLoadStatus('');
          return;
        }

        if (vizCommand.type === 'docking' && vizCommand.pdbData) {
          // Remove previous overlay if any
          if (overlayRef.current) {
            try { stage.removeComponent(overlayRef.current); } catch {}
          }

          setLoadStatus('Loading ligand...');
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });

          if (comp) {
            // Ball+stick for the ligand with a distinct color
            comp.addRepresentation('ball+stick', {
              color: '#e67e22', // orange ligand
              radius: 0.3,
              multipleBond: true,
            });
            comp.addRepresentation('label', {
              labelType: 'text',
              color: '#e67e22',
              fontsize: 0.5,
              showOption: 0,
            });
            comp.name = 'docking-ligand';
            overlayRef.current = comp;
          }
          setLoadStatus('');
        }

        if (vizCommand.type === 'md' && vizCommand.pdbData) {
          // Remove previous trajectory if any
          if (trajCompRef.current) {
            try { stage.removeComponent(trajCompRef.current); } catch {}
          }

          setLoadStatus('Loading trajectory...');
          // Load multi-model PDB as trajectory
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, {
            ext: 'pdb',
            defaultRepresentation: false,
            asTrajectory: true,
          });

          if (comp) {
            comp.addRepresentation('ribbon', {
              color: '#2980b9', // blue trajectory
              subdiv: 2,
            });
            comp.addRepresentation('ball+stick', {
              color: '#2980b9',
              radius: 0.2,
              sele: 'not protein',
            });
            comp.name = 'md-trajectory';
            trajCompRef.current = comp;
          }
          setLoadStatus('');
        }
      } catch (err) {
        console.warn('Viz command failed:', err);
        setLoadStatus('Viz error');
      }
    };

    handleCommand();
  }, [nglReady, vizCommand]);

  /* ── Trajectory frame control ────────────────────────────────────── */
  useEffect(() => {
    if (!trajCompRef.current) return;
    try {
      trajCompRef.current.setFrame(trajFrame);
    } catch {}
  }, [trajFrame]);

  /* ── Picking mode cursor ─────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor = pickingMode ? 'crosshair' : 'default';
  }, [pickingMode]);

  /* ── Atom click → bidirectional binding to store ─────────────────── */
  useEffect(() => {
    if (!stageRef.current || !nglReady) return;
    const stage = stageRef.current;

    const onClick = (pickingProxy: any) => {
      if (!pickingProxy) return;
      const atom = pickingProxy.object?.atom;
      if (!atom) return;

      setSelectedAtom({
        index: atom.index,
        serial: atom.serial,
        name: atom.atomname,
        element: atom.element,
        x: atom.x,
        y: atom.y,
        z: atom.z,
      });
    };

    stage.signals.clicked.add(onClick);
    return () => {
      try { stage.signals.clicked.remove(onClick); } catch { /* noop */ }
    };
  }, [nglReady, setSelectedAtom]);

  /* ── Selected-atom highlight (store → 3D viewer) ─────────────────── */
  useEffect(() => {
    if (!stageRef.current || !selectedAtom) return;
    const stage = stageRef.current;

    // Clear old highlights
    stage.eachComponent((c: any) => {
      if (c.name?.startsWith('highlight-')) stage.removeComponent(c);
    });

    // Add yellow sphere on selected atom position
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NGL = require('ngl');
      const shape = new NGL.Shape('highlight-sphere');
      shape.addSphere(
        [selectedAtom.x, selectedAtom.y, selectedAtom.z],
        [1, 1, 0],  // yellow
        0.5,
        'Selected atom'
      );
      const comp = stage.addComponentFromObject(shape);
      comp.addRepresentation('buffer', { opacity: 0.6 });
      comp.name = `highlight-${selectedAtom.index}`;
    } catch { /* noop */ }
  }, [selectedAtom]);

  /* ── Picking mode actions ─────────────────────────────────────────── */
  const pickDistance = useCallback(() => setPickingMode('distance'), []);
  const pickAngle = useCallback(() => setPickingMode('angle'), []);
  const pickTorsion = useCallback(() => setPickingMode('torsion'), []);
  const pickNone = useCallback(() => setPickingMode(null), []);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center text-navy/50 font-mono text-sm ${className ?? ''}`}>
        {loadError}
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Molecule loading status indicator */}
      {loadStatus && (
        <div className="absolute top-2 left-2 bg-navy/80 text-cream text-xs font-mono px-2 py-1 rounded">
          {loadStatus}
        </div>
      )}

      {/* Empty state */}
      {nglReady && !selectedMolecule && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-navy/30 font-mono text-sm">No molecule loaded</p>
            <p className="text-navy/20 font-mono text-[10px] mt-1">
              Enter a SMILES string or upload a file
            </p>
          </div>
        </div>
      )}

      {/* Picking mode toolbar */}
      {nglReady && selectedMolecule && (
        <div className="absolute top-2 right-2 flex gap-1 text-xs font-mono">
          <button onClick={pickDistance}
            className={`px-2 py-1 rounded ${pickingMode === 'distance' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}>
            Dist
          </button>
          <button onClick={pickAngle}
            className={`px-2 py-1 rounded ${pickingMode === 'angle' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}>
            Angle
          </button>
          <button onClick={pickTorsion}
            className={`px-2 py-1 rounded ${pickingMode === 'torsion' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}>
            Torsion
          </button>
          <button onClick={pickNone}
            className="px-2 py-1 rounded bg-navy/80 text-cream transition-colors">
            Reset
          </button>
        </div>
      )}

      {pickingMode && (
        <div className="absolute top-2 left-2 bg-amber-400 text-navy text-xs font-mono px-2 py-1 rounded">
          Picking: {pickingMode}
        </div>
      )}
    </div>
  );
}