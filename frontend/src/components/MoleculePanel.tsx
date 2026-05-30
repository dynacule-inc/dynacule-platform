'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { moleculeApi, type MoleculeData } from '@/lib/moleculeApi';

export default function MoleculePanel() {
  const { molecules, setMolecules, selectedMolecule, setSelectedMolecule } = useStore();
  const [smilesInput, setSmilesInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch molecules on mount
  useEffect(() => {
    moleculeApi
      .listMolecules()
      .then((data) => {
        setMolecules(data);
      })
      .catch((err) => console.error('Failed to fetch molecules:', err));
  }, [setMolecules]);

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
            className="flex-1 px-2 py-1.5 text-xs font-mono bg-white/50 border border-gold/20 rounded text-navy placeholder:text-navy/30 outline-none focus:border-gold/60 transition-colors"
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
            className="block w-full text-center px-2 py-1.5 text-xs font-mono border border-dashed border-gold/30 rounded text-navy/50 hover:border-gold/60 hover:text-navy/70 cursor-pointer transition-colors"
          >
            + Upload PDB / MOL / SDF
          </label>
        </div>

        {error && (
          <p className="mt-1 text-[10px] font-mono text-red-500 truncate">{error}</p>
        )}
      </div>

      {/* Molecule list */}
      {molecules.length === 0 ? (
        <p className="px-4 py-6 text-xs text-navy/40 font-mono text-center">
          No molecules yet.
        </p>
      ) : (
        <ul className="flex-1 overflow-auto">
          {molecules.map((m) => (
            <li
              key={m.id}
              onClick={() => setSelectedMolecule(m)}
              className={`px-4 py-2.5 cursor-pointer border-b border-gold/10 text-xs font-mono transition-colors ${
                selectedMolecule?.id === m.id
                  ? 'bg-gold/20 text-navy'
                  : 'text-navy/80 hover:bg-gold/10'
              }`}
            >
              <span className="block truncate font-semibold">{m.name}</span>
              <span className="block text-[10px] text-navy/40 truncate mt-0.5">
                {m.formula || m.source}
                {m.smiles && ` · ${m.smiles.substring(0, 40)}${m.smiles.length > 40 ? '…' : ''}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}