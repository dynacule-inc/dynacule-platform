'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Command } from 'cmdk';
import { moleculeApi } from '@/lib/moleculeApi';
import { jobApi } from '@/lib/jobApi';
import { useStore } from '@/lib/store';

type Stage = 'main' | 'smiles-input' | 'descriptors-input' | 'conformers-input' | 'docking-form' | 'md-form' | 'qm-form' | 'result';

interface PipelineView {
  stage: Stage;
  title: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PipelineView>({ stage: 'main', title: '' });
  const [smiles, setSmiles] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { molecules, setMolecules } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        if (!open) reset();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  // Focus input when sub-forms open
  useEffect(() => {
    if (open && view.stage !== 'main' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, view.stage]);

  const reset = useCallback(() => {
    setView({ stage: 'main', title: '' });
    setSmiles('');
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  const goTo = useCallback((stage: Stage, title: string) => {
    setView({ stage, title });
  }, []);

  const showResult = useCallback((title: string, data: unknown) => {
    setResult({ title, data });
    setView({ stage: 'result', title });
    setLoading(false);
  }, []);

  const showError = useCallback((msg: string) => {
    setError(msg);
    setLoading(false);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────

  const handleSmilesCreate = useCallback(async () => {
    const s = smiles.trim();
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const mol = await moleculeApi.createFromSmiles(s);
      setMolecules([mol, ...molecules]);
      showResult('Molecule Created', { name: mol.name, id: mol.id, formula: mol.formula, source: mol.source });
      setSmiles('');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to create molecule');
    }
  }, [smiles, molecules, setMolecules, showResult, showError]);

  const handleDescriptors = useCallback(async () => {
    const s = smiles.trim();
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      // Use the raw molecules endpoint (with graceful degradation)
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/molecules/descriptors?smiles=${encodeURIComponent(s)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      showResult('Descriptors', data.descriptors || data);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to calculate descriptors');
    }
  }, [smiles, showResult, showError]);

  const handleConformers = useCallback(async () => {
    const s = smiles.trim();
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/molecules/conformers?smiles=${encodeURIComponent(s)}&num_conformers=10`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      showResult('Conformers Generated', data);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to generate conformers');
    }
  }, [smiles, showResult, showError]);

  // ── Render helper ─────────────────────────────────────────────────────

  const renderResult = () => {
    if (!result) return null;
    const str = typeof result.data === 'object'
      ? JSON.stringify(result.data, null, 2)
      : String(result.data);
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-cream">{result.title}</span>
          <span className="text-gold text-[10px] font-mono">✓ Done</span>
        </div>
        <pre className="text-[10px] font-mono text-cream/70 bg-cream/5 rounded-lg p-4 max-h-52 overflow-auto whitespace-pre-wrap border border-gold/10">
          {str}
        </pre>
        <button
          onClick={reset}
          className="w-full py-2.5 text-xs font-mono text-cream/50 hover:text-cream bg-cream/5 hover:bg-cream/10 rounded-lg transition-colors"
        >
          Back to menu
        </button>
      </div>
    );
  };

  const renderSmilesForm = (action: 'create' | 'descriptors' | 'conformers') => {
    const handlers: Record<string, () => Promise<void>> = {
      create: handleSmilesCreate,
      descriptors: handleDescriptors,
      conformers: handleConformers,
    };
    const handle = handlers[action];

    return (
      <div className="p-5 space-y-4">
        <p className="text-xs font-mono text-cream/50">{view.title}</p>
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={smiles}
            onChange={(e) => setSmiles(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handle()}
            placeholder="Enter SMILES string..."
            disabled={loading}
            className="flex-1 px-4 py-3 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream placeholder:text-cream/30 outline-none focus:border-gold/60 transition-colors"
          />
          <button
            onClick={handle}
            disabled={loading || !smiles.trim()}
            className="px-5 py-3 text-xs font-mono bg-gold text-navy rounded-lg hover:bg-gold/90 disabled:opacity-40 transition-colors"
          >
            {loading ? '...' : 'Run'}
          </button>
        </div>
        {error && (
          <p className="text-[10px] font-mono text-red-400 break-words">{error}</p>
        )}
        <button
          onClick={reset}
          className="w-full py-2.5 text-xs font-mono text-cream/40 hover:text-cream/70 transition-colors"
        >
          Back
        </button>
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded text-xs font-mono bg-navy/10 text-navy/70 hover:bg-navy/20 transition-colors"
      >
        Cmd+K
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-md flex items-start justify-center pt-20" onClick={close}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>

        {/* ── SMILES Input Form ───────────────────────────────────── */}
        {(view.stage === 'smiles-input') && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            {renderSmilesForm('create')}
          </div>
        )}

        {/* ── Descriptors Input Form ───────────────────────────────── */}
        {(view.stage === 'descriptors-input') && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            {renderSmilesForm('descriptors')}
          </div>
        )}

        {/* ── Conformers Input Form ────────────────────────────────── */}
        {(view.stage === 'conformers-input') && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            {renderSmilesForm('conformers')}
          </div>
        )}

        {/* ── Result View ───────────────────────────────────────────- */}
        {(view.stage === 'result') && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            {renderResult()}
          </div>
        )}

        {/* ── Docking Form ──────────────────────────────────────────- */}
        {(view.stage === 'docking-form') && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            <DockingForm onClose={reset} onResult={(data) => showResult('Docking Job Created', data)} onError={showError} />
          </div>
        )}

        {/* ── MD Form ──────────────────────────────────────────────── */}
        {(view.stage === 'md-form') && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            <MDForm onClose={reset} onResult={(data) => showResult('MD Job Created', data)} onError={showError} />
          </div>
        )}

        {/* ── QM Form ──────────────────────────────────────────────── */}
        {(view.stage === 'qm-form') && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            <QMForm onClose={reset} onResult={(data) => showResult('QM Job Created', data)} onError={showError} />
          </div>
        )}

        {/* ── Main Menu ─────────────────────────────────────────────── */}
        {view.stage === 'main' && (
          <div className="bg-navy border border-gold/40 rounded-xl shadow-2xl overflow-hidden">
            {/* Override cmdk defaults so Tailwind classes win */}
            <style>{`
              [cmdk-root] { background: transparent; }
              [cmdk-input] { font-family: 'Roboto Mono', monospace; }
              [cmdk-list] { padding: 6px; }
              [cmdk-item] { border-radius: 6px; }
              [cmdk-item][data-selected="true"] { background: rgba(201,168,76,0.2); }
              [cmdk-group-heading] { padding: 4px 16px 2px; color: #c9a84c; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
              [cmdk-empty] { color: rgba(249,247,244,0.4); }
            `}</style>
            <Command label="Dynacule Command Palette" className="[&_[cmdk-input]]:w-full [&_[cmdk-input]]:px-5 [&_[cmdk-input]]:py-5 [&_[cmdk-input]]:bg-transparent [&_[cmdk-input]]:text-cream [&_[cmdk-input]]:outline-none [&_[cmdk-input]]:border-b [&_[cmdk-input]]:border-gold/10 [&_[cmdk-input]]:placeholder:text-cream/30 [&_[cmdk-list]]:max-h-96 [&_[cmdk-list]]:overflow-y-auto [&_[cmdk-list]]:p-2">
              <Command.Input
                placeholder="Search pipelines..."
                className="[&_[cmdk-input]]:placeholder:text-cream/40"
              />
              <Command.List className="[&_[cmdk-list]]:max-h-96 [&_[cmdk-list]]:overflow-y-auto [&_[cmdk-list]]:p-2">
                <Command.Empty className="p-6 text-center text-cream/40 text-sm">No results found.</Command.Empty>

                <Command.Group heading="Molecules" className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2">
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => goTo('smiles-input', 'Create from SMILES')}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Create from SMILES</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">Enter a SMILES string to generate 3D structure</div>
                    </div>
                  </Command.Item>
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => {
                      close();
                      document.getElementById('mol-file-input')?.click();
                    }}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Upload Molecule File</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">Upload PDB, MOL, SDF, or MOL2 file</div>
                    </div>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Analysis" className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2">
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => goTo('descriptors-input', 'Calculate Molecular Descriptors')}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Calculate Descriptors</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">MolWt, LogP, HBD, HBA, TPSA, Ring Counts</div>
                    </div>
                  </Command.Item>
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => goTo('conformers-input', 'Generate Conformers')}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Generate Conformers</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">Generate and optimize 3D conformers from SMILES</div>
                    </div>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="Simulations" className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2">
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => goTo('docking-form', 'Setup Vina Docking')}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Setup Vina Docking</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">Configure and run AutoDock Vina molecular docking</div>
                    </div>
                  </Command.Item>
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => goTo('md-form', 'Run MD Simulation')}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Run MD Simulation</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">OpenMM molecular dynamics with AMBER forcefields</div>
                    </div>
                  </Command.Item>
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => goTo('qm-form', 'Run QM Calculation')}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Run QM Calculation</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">Psi4 or ORCA quantum mechanics calculation</div>
                    </div>
                  </Command.Item>
                </Command.Group>

                <Command.Group heading="System" className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2">
                  <Command.Item
                    className="px-5 py-4 rounded-md cursor-pointer text-cream aria-selected:bg-gold/20 [&:hover]:bg-gold/15"
                    onSelect={() => {
                      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/projects/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: `Project ${Date.now()}`, description: 'Created from command palette' }),
                      }).then(() => close()).catch(() => close());
                    }}
                  >
                    <div>
                      <div className="text-sm font-medium text-cream">Create New Project</div>
                      <div className="text-[10px] text-cream/50 font-mono mt-0.5">Create a new project to organize molecules and jobs</div>
                    </div>
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Inline Forms ─────────────────────────────────────────────────────── */

function DockingForm({
  onClose,
  onResult,
  onError,
}: {
  onClose: () => void;
  onResult: (data: unknown) => void;
  onError: (msg: string) => void;
}) {
  const [smiles, setSmiles] = useState('');
  const [centerX, setCenterX] = useState('0');
  const [centerY, setCenterY] = useState('0');
  const [centerZ, setCenterZ] = useState('0');
  const [sizeX, setSizeX] = useState('20');
  const [sizeY, setSizeY] = useState('20');
  const [sizeZ, setSizeZ] = useState('20');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!smiles.trim()) return;
    setLoading(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/docking/`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ligand_smiles: smiles.trim(),
          receptor_pdb_path: '/tmp/receptor.pdb',
          center_x: parseFloat(centerX),
          center_y: parseFloat(centerY),
          center_z: parseFloat(centerZ),
          size_x: parseFloat(sizeX),
          size_y: parseFloat(sizeY),
          size_z: parseFloat(sizeZ),
          exhaustiveness: 8,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      onResult(data);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Docking failed');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs font-mono text-cream/50">Setup Vina Docking</p>

      <label className="block">
        <span className="text-[10px] font-mono text-cream/60">Ligand SMILES</span>
        <input value={smiles} onChange={(e) => setSmiles(e.target.value)}
          className="w-full mt-1 px-4 py-3 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Center X</span>
          <input value={centerX} onChange={(e) => setCenterX(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Center Y</span>
          <input value={centerY} onChange={(e) => setCenterY(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Center Z</span>
          <input value={centerZ} onChange={(e) => setCenterZ(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Size X (A)</span>
          <input value={sizeX} onChange={(e) => setSizeX(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Size Y (A)</span>
          <input value={sizeY} onChange={(e) => setSizeY(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Size Z (A)</span>
          <input value={sizeZ} onChange={(e) => setSizeZ(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-mono text-cream/40 hover:text-cream/70 transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={loading || !smiles.trim()}
          className="flex-1 py-2.5 text-xs font-mono bg-gold text-navy rounded-lg hover:bg-gold/90 disabled:opacity-40 transition-colors">
          {loading ? 'Submitting...' : 'Run Docking'}
        </button>
      </div>
    </div>
  );
}

function MDForm({
  onClose,
  onResult,
  onError,
}: {
  onClose: () => void;
  onResult: (data: unknown) => void;
  onError: (msg: string) => void;
}) {
  const [pdb, setPdb] = useState('');
  const [forcefield, setForcefield] = useState('amber14-all.xml');
  const [steps, setSteps] = useState('50000');
  const [temp, setTemp] = useState('300');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!pdb.trim()) return;
    setLoading(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/md/`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdb_content: pdb.trim(),
          forcefield,
          minimization_steps: 500,
          production_steps: parseInt(steps),
          temperature: parseFloat(temp),
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      onResult(data);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'MD failed');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs font-mono text-cream/50">Run MD Simulation</p>
      <label className="block">
        <span className="text-[10px] font-mono text-cream/60">PDB Content</span>
        <textarea value={pdb} onChange={(e) => setPdb(e.target.value)} rows={3}
          className="w-full mt-1 px-4 py-3 text-[10px] font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60 resize-none" />
      </label>
      <select value={forcefield} onChange={(e) => setForcefield(e.target.value)}
        className="w-full px-4 py-3 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60">
        <option value="amber14-all.xml" className="bg-navy">AMBER14 (all)</option>
        <option value="amber14-all.xml,amber14/protein.ff14SB.xml" className="bg-navy">AMBER14 (ff14SB)</option>
        <option value="charmm36.xml" className="bg-navy">CHARMM36</option>
      </select>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Production Steps</span>
          <input value={steps} onChange={(e) => setSteps(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Temperature (K)</span>
          <input value={temp} onChange={(e) => setTemp(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-mono text-cream/40 hover:text-cream/70 transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={loading || !pdb.trim()}
          className="flex-1 py-2.5 text-xs font-mono bg-gold text-navy rounded-lg hover:bg-gold/90 disabled:opacity-40 transition-colors">
          {loading ? 'Submitting...' : 'Run MD'}
        </button>
      </div>
    </div>
  );
}

function QMForm({
  onClose,
  onResult,
  onError,
}: {
  onClose: () => void;
  onResult: (data: unknown) => void;
  onError: (msg: string) => void;
}) {
  const [software, setSoftware] = useState('psi4');
  const [theory, setTheory] = useState('b3lyp');
  const [basis, setBasis] = useState('6-31g*');
  const [charge, setCharge] = useState('0');
  const [mult, setMult] = useState('1');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/qm/`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          molecule_data: { symbols: ['H', 'H', 'O'], coordinates: [[0, 0, 0], [0, 0.757, 0.586], [0, 0, 0.586]] },
          task_type: 'single_point',
          theory,
          basis_set: basis,
          charge: parseInt(charge),
          multiplicity: parseInt(mult),
          software,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      onResult(data);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'QM failed');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <p className="text-xs font-mono text-cream/50">Run QM Calculation</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Software</span>
          <select value={software} onChange={(e) => setSoftware(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60">
            <option value="psi4" className="bg-navy">Psi4</option>
            <option value="orca" className="bg-navy">ORCA</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Method</span>
          <select value={theory} onChange={(e) => setTheory(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60">
            <option value="b3lyp" className="bg-navy">B3LYP</option>
            <option value="wb97x-d" className="bg-navy">omegaB97X-D</option>
            <option value="pbe0" className="bg-navy">PBE0</option>
            <option value="mp2" className="bg-navy">MP2</option>
            <option value="hf" className="bg-navy">HF</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Basis Set</span>
          <input value={basis} onChange={(e) => setBasis(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Charge</span>
          <input value={charge} onChange={(e) => setCharge(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
        <label className="block">
          <span className="text-[10px] font-mono text-cream/60">Multiplicity</span>
          <input value={mult} onChange={(e) => setMult(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-xs font-mono bg-cream/5 border border-gold/20 rounded-lg text-cream outline-none focus:border-gold/60" />
        </label>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-mono text-cream/40 hover:text-cream/70 transition-colors">Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex-1 py-2.5 text-xs font-mono bg-gold text-navy rounded-lg hover:bg-gold/90 disabled:opacity-40 transition-colors">
          {loading ? 'Calculating...' : 'Run QM'}
        </button>
      </div>
    </div>
  );
}