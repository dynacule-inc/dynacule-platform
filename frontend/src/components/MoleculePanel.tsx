'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore, COLOR_SCHEMES } from '@/lib/store';
import { moleculeApi, type MoleculeData } from '@/lib/moleculeApi';

export default function MoleculePanel() {
  const { molecules, setMolecules, selectedMolecule, setSelectedMolecule, visibilityFlags, setVisibilityFlags, colorScheme, setColorScheme } = useStore();
  const [smilesInput, setSmilesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded molecule state — which molecule entry is showing the Protein/Others subtree
  const [expandedMolId, setExpandedMolId] = useState<number | null>(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; molId: number } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  // Fetch molecules on mount
  useEffect(() => {
    moleculeApi
      .listMolecules()
      .then((data) => {
        setMolecules(data);
      })
      .catch((err) => console.error('Failed to fetch molecules:', err));
  }, [setMolecules]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  const handleSmilesSubmit = async () => {
    const s = smilesInput.trim();
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const mol = await moleculeApi.createFromSmiles(s);
      setMolecules([mol, ...molecules]);
      setSmilesInput('');
      setSelectedMolecule(mol);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create molecule');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const mol = await moleculeApi.uploadFile(file);
      setMolecules([mol, ...molecules]);
      setSelectedMolecule(mol);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Visibility toggle helpers ─────────────────────────────────────────

  const toggleFlag = useCallback((key: 'showRibbon' | 'showAtoms') => {
  setVisibilityFlags({ ...visibilityFlags, [key]: !visibilityFlags[key] });
  }, [visibilityFlags, setVisibilityFlags]);

  const setAllProtein = useCallback((ribbon: boolean, atoms: boolean) => {
  setVisibilityFlags({ showRibbon: ribbon, showAtoms: atoms });
  }, [setVisibilityFlags]);

  const setAllLigand = useCallback((ribbon: boolean, atoms: boolean) => {
  setVisibilityFlags({ showRibbon: ribbon, showAtoms: atoms });
  }, [setVisibilityFlags]);

  const handleContextAction = useCallback((target: 'protein' | 'ligand', action: 'show' | 'hide', what: 'atoms' | 'ribbon') => {
  if (what === 'atoms') setVisibilityFlags({ showRibbon: visibilityFlags.showRibbon, showAtoms: action === 'show' });
  else setVisibilityFlags({ showRibbon: action === 'show', showAtoms: visibilityFlags.showAtoms });
  setCtxMenu(null);
  }, [visibilityFlags, setVisibilityFlags]);

  // ── Subtree row renderer ─────────────────────────────────────────────

  const renderSubtree = (m: MoleculeData) => {
    if (expandedMolId !== m.id) return null;

    const rowStyle = (active: boolean) =>
      `flex items-center justify-between px-6 py-1.5 text-[10px] font-mono transition-colors ${
        active ? 'text-cream' : 'text-cream/40'
      }`;

    const btnStyle = (on: boolean) =>
      `px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
        on ? 'bg-gold/30 text-cream' : 'bg-cream/10 text-cream/40'
      }`;

    return (
      <div className="bg-navy/40 border-t border-gold/10">
        {/* ── Ribbon row ───────────────────────────────────────────────── */}
        <div className={rowStyle(visibilityFlags.showRibbon)}>
          <span className="font-medium">Ribbon</span>
          <button onClick={() => toggleFlag('showRibbon')} className={btnStyle(visibilityFlags.showRibbon)}>
            {visibilityFlags.showRibbon ? 'Ribbon On' : 'Ribbon Off'}
          </button>
        </div>

        {/* ── Atoms row ────────────────────────────────────────────────── */}
        <div className={`${rowStyle(visibilityFlags.showAtoms)} border-t border-gold/5`}>
          <span className="font-medium">Atoms</span>
          <button onClick={() => toggleFlag('showAtoms')} className={btnStyle(visibilityFlags.showAtoms)}>
            {visibilityFlags.showAtoms ? 'Atoms On' : 'Atoms Off'}
          </button>
        </div>

        {/* ── Color by row ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-1.5 text-[10px] font-mono border-t border-gold/5">
          <span className="text-cream/60">Color By</span>
          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value as typeof colorScheme)}
            className="bg-cream/10 border border-gold/20 rounded text-cream text-[9px] font-mono px-2 py-1 outline-none focus:border-gold/60 cursor-pointer"
          >
            {COLOR_SCHEMES.map((s) => (
              <option key={s.value} value={s.value} className="bg-navy text-cream">
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  // ── Context menu ─────────────────────────────────────────────────────

  const renderContextMenu = () => {
    if (!ctxMenu) return null;
    return (
      <div
        ref={ctxRef}
        className="fixed z-[100] bg-navy border border-gold/30 rounded-lg shadow-2xl py-1 min-w-[170px]"
        style={{ left: ctxMenu.x, top: ctxMenu.y }}
        onClick={() => setCtxMenu(null)}
      >
        <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-gold font-mono border-b border-gold/10">Protein</div>
        <button className="w-full text-left px-3 py-1.5 text-xs font-mono text-cream/80 hover:bg-gold/10 hover:text-cream transition-colors" onClick={() => setAllProtein(true, true)}>
          Show All
        </button>
        <button className="w-full text-left px-3 py-1.5 text-xs font-mono text-cream/80 hover:bg-gold/10 hover:text-cream transition-colors" onClick={() => setAllProtein(true, false)}>
          Hide Atoms
        </button>
        <button className="w-full text-left px-3 py-1.5 text-xs font-mono text-cream/80 hover:bg-gold/10 hover:text-cream transition-colors" onClick={() => setAllProtein(false, false)}>
          Hide All
        </button>

        <div className="border-t border-gold/10 mt-1 pt-1">
          <div className="px-3 py-1 text-[9px] uppercase tracking-widest text-gold font-mono">Others</div>
          <button className="w-full text-left px-3 py-1.5 text-xs font-mono text-cream/80 hover:bg-gold/10 hover:text-cream transition-colors" onClick={() => setAllLigand(true, true)}>
            Show All
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs font-mono text-cream/80 hover:bg-gold/10 hover:text-cream transition-colors" onClick={() => setAllLigand(true, false)}>
            Hide Atoms
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs font-mono text-cream/80 hover:bg-gold/10 hover:text-cream transition-colors" onClick={() => setAllLigand(false, false)}>
            Hide All
          </button>
        </div>
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full border-t border-gold/20">
      <h2 className="px-4 py-3 text-sm font-semibold text-navy uppercase tracking-wider border-b border-gold/20">
        Molecules
      </h2>

      {/* SMILES input */}
      <div className="px-3 py-3 border-b border-gold/10">
        <div className="flex gap-1">
          <input
            type="text"
            value={smilesInput}
            onChange={(e) => setSmilesInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSmilesSubmit()}
            placeholder="Enter SMILES..."
            className="flex-1 px-2 py-1.5 text-xs font-mono bg-cream/5 border border-gold/20 rounded text-cream placeholder:text-cream/30 outline-none focus:border-gold/60 transition-colors"
            disabled={loading}
          />
          <button
            onClick={handleSmilesSubmit}
            disabled={loading || !smilesInput.trim()}
            className="px-2 py-1.5 text-xs font-mono bg-navy text-cream rounded hover:bg-navy/90 disabled:opacity-40 transition-colors"
          >
            {loading ? '...' : 'Go'}
          </button>
        </div>

        {/* File upload */}
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdb,.mol,.sdf,.mol2"
            onChange={handleFileUpload}
            className="hidden"
            id="mol-file-input"
          />
          <label
            htmlFor="mol-file-input"
            className="block w-full text-center px-2 py-1.5 text-xs font-mono border border-dashed border-gold/30 rounded text-cream/50 hover:border-gold/60 hover:text-cream/70 cursor-pointer transition-colors"
          >
            + Upload PDB / MOL / SDF
          </label>
        </div>

        {error && (
          <p className="mt-1 text-[10px] font-mono text-red-400 truncate">{error}</p>
        )}
      </div>

      {/* Molecule list */}
      {molecules.length === 0 ? (
        <p className="px-4 py-6 text-xs text-cream/40 font-mono text-center">
          No molecules yet.
        </p>
      ) : (
        <ul className="flex-1 overflow-auto max-h-48">
          {molecules.map((m) => (
            <li key={m.id}>
              {/* Molecule entry row */}
              <div
                onClick={() => {
                  setSelectedMolecule(m);
                  setExpandedMolId(expandedMolId === m.id ? null : m.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, molId: m.id });
                }}
                className={`px-4 py-2.5 cursor-pointer border-b border-gold/10 text-xs font-mono transition-colors ${
                  selectedMolecule?.id === m.id
                    ? 'bg-gold/20 text-navy'
                    : 'text-cream/80 hover:bg-gold/10'
                }`}
              >
                <span className="block truncate font-semibold">{m.name}</span>
                <span className="block text-[10px] text-cream/40 truncate mt-0.5">
                  {m.formula || m.source}
                  {m.smiles && ` · ${m.smiles.substring(0, 40)}${m.smiles.length > 40 ? '…' : ''}`}
                </span>
              </div>

              {/* Expandable subtree */}
              {renderSubtree(m)}
            </li>
          ))}
        </ul>
      )}

      {/* Context menu overlay */}
      {renderContextMenu()}
    </div>
  );
}