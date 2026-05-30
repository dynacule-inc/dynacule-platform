'use client';

import ProjectTable from '@/components/ProjectTable';
import MolecularViewer from '@/components/MolecularViewer';
import MoleculePanel from '@/components/MoleculePanel';
import MoleculeDetailPanel from '@/components/MoleculeDetailPanel';
import JobPanel from '@/components/JobPanel';
import ResultsViewer from '@/components/ResultsViewer';
import CommandPalette from '@/components/CommandPalette';
import StatusBar from '@/components/StatusBar';
import { useStore } from '@/lib/store';

export default function Home() {
  const { selectedProjectId, selectedMolecule } = useStore();

  return (
    <div className="flex h-screen bg-cream">
      {/* Sidebar — Project Table + Molecule Panel + Job Panel */}
      <aside className="w-72 border-r border-gold/20 bg-cream flex flex-col">
        <header className="px-4 py-3 border-b border-gold/20 shrink-0">
          <h1 className="text-lg font-semibold text-navy tracking-tight">Dynacule</h1>
          <p className="text-xs text-navy/50 font-mono">Molecular Design Suite</p>
        </header>
        <div className="flex-1 overflow-auto flex flex-col min-h-0">
          <div className="shrink-0 max-h-[30%] min-h-0 flex flex-col">
            <ProjectTable />
          </div>
          <div className="flex-1 min-h-0 flex flex-col border-t border-gold/10">
            <MoleculePanel />
          </div>
          <div className="shrink-0 max-h-[30%] min-h-0 flex flex-col border-t border-gold/10">
            <JobPanel />
          </div>
        </div>
      </aside>

      {/* Main content — 3D Viewer + toolbar */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gold/20 bg-cream shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-navy/70">
              {selectedProjectId ? `Project: ${selectedProjectId}` : 'No project selected'}
            </span>
            {selectedMolecule && (
              <span className="text-sm font-mono text-navy/50">
                · {selectedMolecule.name}
              </span>
            )}
          </div>
          <CommandPalette />
        </div>
        <ResultsViewer />
        <MolecularViewer className="flex-1" projectId={selectedProjectId} />
        <MoleculeDetailPanel />
      </main>

      {/* Real-time status bar */}
      <StatusBar />
    </div>
  );
}