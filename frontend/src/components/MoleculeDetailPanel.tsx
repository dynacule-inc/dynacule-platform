'use client';

import { useEffect, useState, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { moleculeApi } from '@/lib/moleculeApi';
import SmilesDepict from './SmilesDepict';
import RadarChart, { normalizeDescriptors } from './RadarChart';

interface DescriptorRes {
  descriptors: Record<string, number>;
  note?: string;
}

export default function MoleculeDetailPanel() {
  const { selectedMolecule, setSelectedMolecule } = useStore();
  const [descriptors, setDescriptors] = useState<DescriptorRes | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch descriptors when molecule changes
  useEffect(() => {
    if (!selectedMolecule?.id) {
      setDescriptors(null);
      return;
    }

    setLoading(true);
    fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
      }/molecules/${selectedMolecule.id}/descriptors`
    )
      .then((r) => r.json())
      .then((data) => setDescriptors(data))
      .catch(() => setDescriptors(null))
      .finally(() => setLoading(false));
  }, [selectedMolecule?.id]);

  const radarData = useMemo(
    () => (descriptors?.descriptors ? normalizeDescriptors(descriptors.descriptors) : []),
    [descriptors]
  );

  if (!selectedMolecule) return null;

  const desc = descriptors?.descriptors ?? {};

  return (
    <div className="fixed bottom-8 left-2 z-30 w-[320px]">
      <div className="bg-cream/95 backdrop-blur-sm border border-gold/30 rounded-lg shadow-xl overflow-hidden font-mono">

        {/* Header with close button */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gold/20">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-navy truncate">{selectedMolecule.name}</h3>
            <p className="text-[9px] text-navy/40 truncate">
              #{selectedMolecule.id} · {selectedMolecule.formula || '—'}
            </p>
          </div>
          <button
            onClick={() => setSelectedMolecule(null)}
            className="text-[9px] text-navy/30 hover:text-navy transition-colors shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        <div className="p-3 space-y-3 max-h-[420px] overflow-y-auto">

          {/* 2D depiction + info row */}
          <div className="flex gap-3">
            <div className="shrink-0 w-[110px] h-[110px] bg-white/50 border border-gold/10 rounded flex items-center justify-center">
              {selectedMolecule.smiles ? (
                <SmilesDepict smiles={selectedMolecule.smiles} size={110} />
              ) : (
                <span className="text-[9px] text-navy/30">No SMILES</span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex justify-between text-[9px]">
                <span className="text-navy/40">SMILES</span>
                <span className="text-navy text-right max-w-[140px] truncate" title={selectedMolecule.smiles}>
                  {selectedMolecule.smiles || '—'}
                </span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-navy/40">Source</span>
                <span className="text-navy uppercase">{selectedMolecule.source}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-navy/40">Created</span>
                <span className="text-navy">
                  {selectedMolecule.created_at
                    ? new Date(selectedMolecule.created_at).toLocaleDateString()
                    : '—'}
                </span>
              </div>
              {descriptors?.note && (
                <p className="text-[8px] text-amber-500 mt-1">{descriptors.note}</p>
              )}
            </div>
          </div>

          {/* Radar chart */}
          {radarData.length > 0 && (
            <div className="flex justify-center py-1">
              <RadarChart data={radarData} size={170} />
            </div>
          )}

          {/* Descriptors table */}
          {Object.keys(desc).length > 0 && (
            <div>
              <h4 className="text-[9px] uppercase tracking-wider text-navy/50 mb-1.5">Physicochemical Properties</h4>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {[
                  { key: 'MolWt', label: 'Mol. Weight', unit: 'g/mol', fmt: (v: number) => v.toFixed(1) },
                  { key: 'LogP', label: 'LogP', fmt: (v: number) => v.toFixed(2) },
                  { key: 'NumHDonors', label: 'H-Bond Donors', fmt: (v: number) => String(v) },
                  { key: 'NumHAcceptors', label: 'H-Bond Acceptors', fmt: (v: number) => String(v) },
                  { key: 'NumRotatableBonds', label: 'Rot. Bonds', fmt: (v: number) => String(v) },
                  { key: 'TPSA', label: 'TPSA', unit: 'Å²', fmt: (v: number) => v.toFixed(1) },
                  { key: 'RingCount', label: 'Ring Count', fmt: (v: number) => String(v) },
                  { key: 'HeavyAtomCount', label: 'Heavy Atoms', fmt: (v: number) => String(v) },
                  { key: 'FractionCSP3', label: 'Fsp³', fmt: (v: number) => v.toFixed(2) },
                  ...('NumAromaticRings' in desc ? [{ key: 'NumAromaticRings' as string, label: 'Arom. Rings', fmt: (v: number) => String(v) }] : []),
                ].map(({ key, label, fmt }) => {
                  const val = desc[key];
                  if (val === undefined) return null;
                  return (
                    <div key={key} className="flex justify-between text-[9px] leading-5 border-b border-gold/10 last:border-0">
                      <span className="text-navy/50">{label}</span>
                      <span className="text-navy font-medium">{fmt(val)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center text-[9px] text-navy/30 py-2">
              Loading properties...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}