'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { moleculeApi } from '@/lib/moleculeApi';
import type { ViewPreset } from '@/lib/store';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  NGL Stage Component                                                        */
/*  NGL requires WebGL — only runs in the browser. We use dynamic              */
/*  import so Next.js doesn't try to SSR it.                                    */
/* ─────────────────────────────────────────────────────────────────────────── */

interface MolecularViewerProps {
  className?: string;
  projectId?: string | null;
}

/* ── Preset definitions ────────────────────────────────────────────────────── */
const PRESET_LABELS: Record<ViewPreset, string> = {
  dynacule: 'Dynacule',
  cartoon:  'Cartoon',
  ribbon:   'Ribbon',
  surface:  'Surface',
  cpk:      'CPK',
  backbone: 'Backbone',
};

/* Apply a named preset to a component. The stage is needed to dispose shapes. */
async function applyPreset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any,
  preset: ViewPreset,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stage: any,
) {
  component.removeAllRepresentations();

  const atomColor   = '#2a2a2a';
  const helixColor  = '#2a2a2a';
  const sheetColor  = '#2a2a2a';
  const coilColor   = '#2a2a2a';

  switch (preset) {
    /* ── Dynacule ────────────────────────────────────────────────────────── */
    case 'dynacule': {
      // Thick ribbon for alpha-helices and beta-sheets — scale ≈ 12 hides tubes
      component.addRepresentation('ribbon', {
        color:       helixColor,
        opacity:     1,
        mainChain:   ' helix',
        subdiv:      6,
        smoothSheet: true,
        scale:       12.0,
      });
      component.addRepresentation('ribbon', {
        color:     sheetColor,
        opacity:   1,
        mainChain: ' sheet',
        subdiv:    6,
        scale:     10.0,
      });
      // Thin tube only for coils / turns — radius ≈ 0.12, much smaller than ribbon
      component.addRepresentation('tube', {
        color:     coilColor,
        opacity:   1,
        mainChain: ' coil',
        radius:    0.12,
        subdiv:    4,
      });
      // Ball+stick for non-protein atoms (ligands, waters, ions)
      component.addRepresentation('ball+stick', {
        color:        atomColor,
        radius:       0.3,
        multipleBond: true,
        opacity:      1,
        Sele:         'not protein',
      });
      break;
    }

    /* ── Cartoon ─────────────────────────────────────────────────────────── */
    case 'cartoon': {
      component.addRepresentation('cartoon', {
        color:       '#3b82f6',
        opacity:     1,
        mainChain:   ' helix',
        subdiv:      6,
        smoothSheet: true,
        scale:        5.0,
      });
      component.addRepresentation('cartoon', {
        color:     '#22c55e',
        opacity:   1,
        mainChain: ' sheet',
        subdiv:    6,
        scale:      4.0,
      });
      component.addRepresentation('cartoon', {
        color:     '#94a3b8',
        opacity:   1,
        mainChain: ' coil',
        scale:      3.0,
      });
      component.addRepresentation('ball+stick', {
        color:        '#2a2a2a',
        radius:       0.3,
        multipleBond: true,
        Sele:         'not protein',
      });
      break;
    }

    /* ── Ribbon ─────────────────────────────────────────────────────────── */
    case 'ribbon': {
      component.addRepresentation('ribbon', {
        color:       '#7c3aed',
        opacity:     1,
        smoothSheet: true,
        subdiv:      8,
        scale:        9.0,
      });
      component.addRepresentation('ball+stick', {
        color:        '#2a2a2a',
        radius:       0.3,
        multipleBond: true,
        Sele:         'not protein',
      });
      break;
    }

    /* ── Surface ────────────────────────────────────────────────────────── */
    case 'surface': {
      component.addRepresentation('surface', {
        color:           '#d4c5a9',
        opacity:         0.85,
        surfaceType:     'av',
        surfaceSelection: 'protein',
        contour:         false,
      });
      component.addRepresentation('ball+stick', {
        color:        '#2a2a2a',
        radius:       0.25,
        multipleBond: true,
        opacity:      1,
        Sele:         'not protein',
      });
      break;
    }

    /* ── CPK ────────────────────────────────────────────────────────────── */
    case 'cpk': {
      component.addRepresentation('ball+stick', {
        color:        '#c9a84c',
        radius:       0.25,
        multipleBond: true,
        opacity:      1,
      });
      break;
    }

    /* ── Backbone ──────────────────────────────────────────────────────── */
    case 'backbone': {
      component.addRepresentation('backbone', {
        color:   '#2a2a2a',
        opacity:  1,
        radius:   0.3,
      });
      break;
    }
  }

  setTimeout(() => {
    try { component.autoView(400); } catch { /* noop */ }
  }, 100);
}

export default function MolecularViewer({ className, projectId }: MolecularViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stageRef = useRef<any>(null);
  const [pickingMode, setPickingMode] = useState<'distance' | 'angle' | 'torsion' | null>(null);
  const [nglReady, setNglReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    selectedAtom, setSelectedAtom,
    selectedMolecule,
    vizCommand, setVizCommand,
    trajFrame,
    viewPreset, setViewPreset,
  } = useStore();
  const [loadStatus, setLoadStatus] = useState<string>('');

  /* ── NGL init ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || stageRef.current) return;
    let destroyed = false;

    const initNGL = async () => {
      try {
        const NGL = await import('ngl');
        if (destroyed || !containerRef.current) return;

        const stage = new NGL.Stage(containerRef.current, {
          backgroundColor: '#f9f7f4',
        });
        stageRef.current = stage;
        stage.handleResize();
        setNglReady(true);

        // Load default sample (1crn) so the canvas isn't empty
        try {
          const comp = await stage.loadFile('rcsb://1crn', { defaultRepresentation: false });
          if (comp) {
            await applyPreset(comp, 'dynacule', stage);
            comp.setName('default-sample');
            setTimeout(() => {
              try { stage.autoView(400); } catch { /* noop */ }
            }, 100);
          }
        } catch {
          // Offline or CORS — empty canvas is acceptable
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load molecule into viewer ─────────────────────────────────────────── */
  const loadMolecule = useCallback(async (molId: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    try {
      setLoadStatus('Loading…');
      const { pdb } = await moleculeApi.getPdb(molId);

      // Remove existing loaded components (keep the stage itself)
      stage.eachComponent((c: any) => {
        if (c.name?.startsWith('highlight-') || c.name === '__measurements__') return;
        stage.removeComponent(c);
      });

      const blob = new Blob([pdb], { type: 'text/plain' });
      const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });
      if (comp) {
        await applyPreset(comp, viewPreset, stage);
      }
      setLoadStatus('');
    } catch (err) {
      console.warn('Failed to load molecule:', err);
      setLoadStatus('Load failed');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPreset]);

  /* ── Watch selected molecule ───────────────────────────────────────────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    loadMolecule(selectedMolecule.id);
  }, [selectedMolecule, nglReady, loadMolecule]);

  /* ── Re-apply preset when preset changes (without re-loading molecule) ── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastPresetMolRef = useRef<any>(null);
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    const stage = stageRef.current;
    if (!stage) return;

    stage.eachComponent((c: any) => {
      if (
        c.name === selectedMolecule.id?.toString() ||
        c.name === 'loaded-molecule'
      ) {
        applyPreset(c, viewPreset, stage);
        lastPresetMolRef.current = c;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPreset, nglReady]);

  /* ── Visualization command handling (docking overlay, MD traj, QM) ─────── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlayRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trajCompRef = useRef<any>(null);

  useEffect(() => {
    if (!nglReady || !stageRef.current) return;
    const stage = stageRef.current;

    if (!vizCommand) return;

    const handleCommand = async () => {
      try {
        if (vizCommand.type === 'clear' || vizCommand.type === 'qm') {
          if (overlayRef.current) {
            try { stage.removeComponent(overlayRef.current); } catch { /* noop */ }
            overlayRef.current = null;
          }
          if (trajCompRef.current) {
            try { stage.removeComponent(trajCompRef.current); } catch { /* noop */ }
            trajCompRef.current = null;
          }
          setLoadStatus('');
          return;
        }

        if (vizCommand.type === 'docking' && vizCommand.pdbData) {
          if (overlayRef.current) {
            try { stage.removeComponent(overlayRef.current); } catch { /* noop */ }
          }

          setLoadStatus('Loading ligand…');
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });

          if (comp) {
            comp.addRepresentation('ball+stick', {
              color:        '#e67e22',
              radius:       0.3,
              multipleBond: true,
              opacity:      1,
            });
            comp.addRepresentation('label', {
              labelType: 'text',
              color:     '#e67e22',
              fontSize:  0.5,
              showOption: 0,
            });
            comp.setName('docking-ligand');
            overlayRef.current = comp;
          }
          setLoadStatus('');
        }

        if (vizCommand.type === 'md' && vizCommand.pdbData) {
          if (trajCompRef.current) {
            try { stage.removeComponent(trajCompRef.current); } catch { /* noop */ }
          }

          setLoadStatus('Loading trajectory…');
          const blob = new Blob([vizCommand.pdbData], { type: 'text/plain' });
          const comp = await stage.loadFile(blob, {
            ext:               'pdb',
            defaultRepresentation: false,
            asTrajectory:     true,
          });

          if (comp) {
            comp.addRepresentation('ribbon', {
              color:   '#2980b9',
              subdiv:  2,
              opacity: 1,
            });
            comp.addRepresentation('ball+stick', {
              color:  '#2980b9',
              radius: 0.2,
              Sele:   'not protein',
            });
            comp.setName('md-trajectory');
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

  /* ── Trajectory frame control ──────────────────────────────────────────── */
  useEffect(() => {
    if (!trajCompRef.current) return;
    try {
      trajCompRef.current.setFrame(trajFrame);
    } catch { /* noop */ }
  }, [trajFrame]);

  /* ── Picking mode cursor ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor = pickingMode ? 'crosshair' : 'default';
  }, [pickingMode]);

  /* ── Atom click → bidirectional binding to store ──────────────────────── */
  useEffect(() => {
    if (!stageRef.current || !nglReady) return;
    const stage = stageRef.current;

    const onClick = (pickingProxy: any) => {
      if (!pickingProxy) return;
      const atom = pickingProxy.object?.atom;
      if (!atom) return;

      setSelectedAtom({
        index:   atom.index,
        serial:   atom.serial,
        name:     atom.atomname,
        element:  atom.element,
        x:        atom.x,
        y:        atom.y,
        z:        atom.z,
      });
    };

    stage.signals.clicked.add(onClick);
    return () => {
      try { stage.signals.clicked.remove(onClick); } catch { /* noop */ }
    };
  }, [nglReady, setSelectedAtom]);

  /* ── Selected-atom highlight (store → 3D viewer) ────────────────────── */
  useEffect(() => {
    if (!stageRef.current || !selectedAtom) return;
    const stage = stageRef.current;

    stage.eachComponent((c: any) => {
      if (c.name?.startsWith('highlight-')) stage.removeComponent(c);
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NGL = require('ngl');
      const shape = new NGL.Shape('highlight-sphere');
      shape.addSphere(
        [selectedAtom.x, selectedAtom.y, selectedAtom.z],
        [1, 1, 0],  // yellow
        0.5,
        'Selected atom',
      );
      const comp = stage.addComponentFromObject(shape);
      comp.addRepresentation('buffer', { opacity: 0.6 });
      comp.setName(`highlight-${selectedAtom.index}`);
    } catch { /* noop */ }
  }, [selectedAtom]);

  /* ── Picking mode actions ──────────────────────────────────────────────── */
  const pickDistance = useCallback(() => setPickingMode('distance'), []);
  const pickAngle    = useCallback(() => setPickingMode('angle'),    []);
  const pickTorsion  = useCallback(() => setPickingMode('torsion'),  []);
  const pickNone     = useCallback(() => setPickingMode(null),        []);

  if (loadError) {
    return (
      <div className={`flex items-center justify-center text-navy/50 font-mono text-sm ${className ?? ''}`}>
        {loadError}
      </div>
    );
  }

  const presets = Object.entries(PRESET_LABELS) as [ViewPreset, string][];

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* ── Loading status ──────────────────────────────────────────────── */}
      {loadStatus && (
        <div className="absolute top-2 left-2 bg-navy/80 text-cream text-xs font-mono px-2 py-1 rounded">
          {loadStatus}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
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

      {/* ── Preset toolbar (top-right, above picking) ───────────────────── */}
      {nglReady && selectedMolecule && (
        <div className="absolute top-2 right-2 flex gap-1 flex-wrap max-w-[240px] justify-end">
          {presets.map(([preset, label]) => (
            <button
              key={preset}
              onClick={() => setViewPreset(preset)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                viewPreset === preset
                  ? 'bg-gold text-navy font-semibold'
                  : 'bg-navy/80 text-cream hover:bg-navy'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Picking mode toolbar (below presets) ────────────────────────── */}
      {nglReady && selectedMolecule && (
        <div className="absolute top-2 left-2 flex gap-1 text-xs font-mono">
          <button
            onClick={pickDistance}
            className={`px-2 py-1 rounded ${pickingMode === 'distance' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}
          >
            Dist
          </button>
          <button
            onClick={pickAngle}
            className={`px-2 py-1 rounded ${pickingMode === 'angle' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}
          >
            Angle
          </button>
          <button
            onClick={pickTorsion}
            className={`px-2 py-1 rounded ${pickingMode === 'torsion' ? 'bg-amber-400 text-navy' : 'bg-navy/80 text-cream'} transition-colors`}
          >
            Torsion
          </button>
          <button
            onClick={pickNone}
            className="px-2 py-1 rounded bg-navy/80 text-cream hover:bg-navy transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {/* ── Picking mode badge ──────────────────────────────────────────── */}
      {pickingMode && (
        <div className="absolute top-2 left-2 mt-8 bg-amber-400 text-navy text-xs font-mono px-2 py-1 rounded">
          Picking: {pickingMode}
        </div>
      )}
    </div>
  );
}
