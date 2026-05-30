'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { moleculeApi } from '@/lib/moleculeApi';
import type { ViewPreset } from '@/lib/store';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  NGL Stage Component                                                        */
/*  NGL requires WebGL — only runs in the browser.                            */
/* ─────────────────────────────────────────────────────────────────────────── */

interface MolecularViewerProps {
  className?: string;
  projectId?: string | null;
}

/* ── Preset display labels ─────────────────────────────────────────────────── */
const PRESET_LABELS: Record<ViewPreset, string> = {
  dynacule: 'Dynacule',
  cartoon:  'Cartoon',
  ribbon:   'Ribbon',
  surface:  'Surface',
  cpk:      'CPK',
  backbone: 'Backbone',
};

/* ── CPK-inspired element color palette ───────────────────────────────────── */
const ELEMENT_COLORS: Record<string, [number, number, number]> = {
  H:  [0.90, 0.90, 0.90],
  C:  [0.25, 0.25, 0.25],
  N:  [0.13, 0.37, 0.90],
  O:  [0.91, 0.13, 0.13],
  S:  [0.95, 0.80, 0.10],
  P:  [1.00, 0.50, 0.00],
  F:  [0.20, 0.80, 0.20],
  CL: [0.12, 0.75, 0.12],
  BR: [0.60, 0.15, 0.10],
  FE: [0.80, 0.40, 0.10],
  MG: [0.30, 0.90, 0.30],
  CA: [0.10, 0.80, 0.80],
  ZN: [0.20, 0.50, 0.70],
  default: [0.45, 0.45, 0.55],
};

function elementColorScheme() {
  return Object.fromEntries(
    Object.entries(ELEMENT_COLORS).map(([el, rgb]) => [el, `rgb(${rgb.join(',')})`]),
  );
}

/* ── Apply a preset to a component ─────────────────────────────────────────── */
/**
 * @param component  NGL StructureComponent / RepresentationComponent
 * @param preset     Active view preset
 * @param stage      NGL Stage (passed for potential shape/shell use)
 * @param nearLigand Selection string targeting atoms within 10A of any
 *                   non-protein atom (ligand, waters, ions, metals).
 *                   Passed as '' when no such atoms exist in the structure.
 */
async function applyPreset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: any,
  preset: ViewPreset,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stage: any,
  nearLigand: string,
) {
  component.removeAllRepresentations();

  const elemCol = elementColorScheme();

  /* ── Near-ligand protein selection ─────────────────────────────────────── */
  // Protein atoms within 10A of ligand/waters/ions
  const nearProt = nearLigand ? `(protein ${nearLigand})` : '';

  switch (preset) {
    /* ── Dynacule ────────────────────────────────────────────────────────── */
    case 'dynacule': {
      // Thick ribbon for helices / sheets — scale 10-12 fully occludes tube
      component.addRepresentation('ribbon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:     1,
        mainChain:   ' helix',
        subdiv:       6,
        smoothSheet:  true,
        scale:        12.0,
      });
      component.addRepresentation('ribbon', {
        color:       'element',
        colorScheme: elemCol,
        opacity:     1,
        mainChain:   ' sheet',
        subdiv:       6,
        scale:        10.0,
      });
      // Thin tube for coils / turns — deliberately smaller than ribbon
      component.addRepresentation('tube', {
        color:       'element',
        colorScheme: elemCol,
        opacity:     1,
        mainChain:   ' coil',
        radius:       0.12,
        subdiv:       4,
      });
      // Ball+stick: non-protein atoms (ligands, waters, ions) — always visible
      component.addRepresentation('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        opacity:       1,
        Sele:          'not protein',
      });
      // Ball+stick: protein sidechains within 10A of ligand
      if (nearProt) {
        component.addRepresentation('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          opacity:        1,
          Sele:          nearProt,
        });
      }
      break;
    }

    /* ── Cartoon ─────────────────────────────────────────────────────────── */
    case 'cartoon': {
      component.addRepresentation('cartoon', {
        color:       'element',
        colorScheme:  elemCol,
        opacity:       1,
        mainChain:    ' helix',
        subdiv:        6,
        smoothSheet:   true,
        scale:         5.0,
      });
      component.addRepresentation('cartoon', {
        color:       'element',
        colorScheme:  elemCol,
        opacity:       1,
        mainChain:    ' sheet',
        subdiv:        6,
        scale:         4.0,
      });
      component.addRepresentation('cartoon', {
        color:       'element',
        colorScheme:  elemCol,
        opacity:       1,
        mainChain:    ' coil',
        scale:         3.0,
      });
      // Non-protein
      component.addRepresentation('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         'not protein',
      });
      // Near-ligand protein sidechains
      if (nearProt) {
        component.addRepresentation('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        });
      }
      break;
    }

    /* ── Ribbon ──────────────────────────────────────────────────────────── */
    case 'ribbon': {
      component.addRepresentation('ribbon', {
        color:       'element',
        colorScheme:  elemCol,
        opacity:       1,
        smoothSheet:   true,
        subdiv:        8,
        scale:         9.0,
      });
      component.addRepresentation('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.3,
        multipleBond:  true,
        Sele:         'not protein',
      });
      if (nearProt) {
        component.addRepresentation('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        });
      }
      break;
    }

    /* ── Surface ────────────────────────────────────────────────────────── */
    case 'surface': {
      component.addRepresentation('surface', {
        color:            '#d4c5a9',
        opacity:           0.82,
        surfaceType:       'av',
        surfaceSelection:  'protein',
        contour:           false,
      });
      component.addRepresentation('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        Sele:         'not protein',
      });
      if (nearProt) {
        component.addRepresentation('ball+stick', {
          color:        'element',
          colorScheme:  elemCol,
          radius:        0.18,
          multipleBond:  true,
          Sele:         nearProt,
        });
      }
      break;
    }

    /* ── CPK ────────────────────────────────────────────────────────────── */
    case 'cpk': {
      // Full CPK ball+stick for everything
      component.addRepresentation('ball+stick', {
        color:        'element',
        colorScheme:  elemCol,
        radius:        0.25,
        multipleBond:  true,
        opacity:       1,
      });
      break;
    }

    /* ── Backbone ───────────────────────────────────────────────────────── */
    case 'backbone': {
      component.addRepresentation('backbone', {
        color:        'element',
        colorScheme:  elemCol,
        opacity:        1,
        radius:        0.3,
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
  const [loadStatus, setLoadStatus] = useState<string>('');

  const {
    selectedAtom, setSelectedAtom,
    selectedMolecule,
    vizCommand, setVizCommand,
    trajFrame,
    viewPreset, setViewPreset,
  } = useStore();

  /**
   * NGL selection string for all non-protein atoms in the loaded structure.
   * Used to derive the "within 10A of ligand" protein sub-selection.
   * Reset to '' on every new molecule load.
   */
  const ligandAtomsSel = useRef<string>('');

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

        try {
          const comp = await stage.loadFile('rcsb://1crn', { defaultRepresentation: false });
          if (comp) {
            // 1crn is a pure protein — no near-ligand atoms
            ligandAtomsSel.current = '';
            await applyPreset(comp, 'dynacule', stage, '');
            comp.setName('default-sample');
            setTimeout(() => {
              try { stage.autoView(400); } catch { /* noop */ }
            }, 100);
          }
        } catch {
          // offline / CORS — empty canvas is acceptable
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

      stage.eachComponent((c: any) => {
        if (c.name?.startsWith('highlight-') || c.name === '__measurements__') return;
        stage.removeComponent(c);
      });

      const blob = new Blob([pdb], { type: 'text/plain' });
      const comp = await stage.loadFile(blob, { ext: 'pdb', defaultRepresentation: false });

      if (comp) {
        comp.setName('loaded-molecule');

        // ── Derive non-protein atom selection for near-ligand filter ─────
        // 'not protein' captures ligands, waters, ions, metals, cofactors, etc.
        ligandAtomsSel.current = 'not protein';

        await applyPreset(comp, viewPreset, stage, ligandAtomsSel.current);
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

  /* ── Re-apply preset when it changes (no molecule reload needed) ──────── */
  useEffect(() => {
    if (!nglReady || !selectedMolecule) return;
    const stage = stageRef.current;
    if (!stage) return;

    stage.eachComponent((c: any) => {
      if (c.name === 'loaded-molecule') {
        applyPreset(c, viewPreset, stage, ligandAtomsSel.current);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewPreset, nglReady]);

  /* ── Viz command handling (docking overlay, MD traj, QM) ───────────────── */
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
              color:        'element',
              colorScheme:  elementColorScheme(),
              radius:        0.3,
              multipleBond:  true,
              opacity:       1,
            });
            comp.addRepresentation('label', {
              labelType:  'text',
              color:      '#e67e22',
              fontSize:   0.5,
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
            asTrajectory:      true,
          });

          if (comp) {
            comp.addRepresentation('ribbon', {
              color:   'element',
              colorScheme: elementColorScheme(),
              subdiv:   2,
              opacity:  1,
            });
            comp.addRepresentation('ball+stick', {
              color:  'element',
              colorScheme: elementColorScheme(),
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

  /* ── Atom click → store ───────────────────────────────────────────────── */
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

  /* ── Selected-atom highlight ───────────────────────────────────────────── */
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
        [1, 1, 0], // yellow
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

      {/* ── Loading status ─────────────────────────────────────────────── */}
      {loadStatus && (
        <div className="absolute top-2 left-2 bg-navy/80 text-cream text-xs font-mono px-2 py-1 rounded">
          {loadStatus}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
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

      {/* ── Preset toolbar ──────────────────────────────────────────────── */}
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

      {/* ── Picking mode toolbar ──────────────────────────────────────── */}
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

      {/* ── Picking mode badge ────────────────────────────────────────── */}
      {pickingMode && (
        <div className="absolute top-2 left-2 mt-8 bg-amber-400 text-navy text-xs font-mono px-2 py-1 rounded">
          Picking: {pickingMode}
        </div>
      )}
    </div>
  );
}
