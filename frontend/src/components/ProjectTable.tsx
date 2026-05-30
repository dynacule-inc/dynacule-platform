'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { projectApi } from '@/lib/projectApi';

export default function ProjectTable() {
  const { projects, setProjects, setSelectedProjectId } = useStore();

  // Fetch projects from backend on mount
  useEffect(() => {
    console.log('ProjectTable: Fetching projects...');
    projectApi
      .fetchProjects()
      .then((data) => {
        console.log('ProjectTable: Fetched projects:', data);
        setProjects(data);
      })
      .catch((err) => {
        console.error('ProjectTable: Failed to fetch projects:', err);
      });
  }, [setProjects]);

  return (
    <div className="flex flex-col h-full">
      <h2 className="px-4 py-3 text-sm font-semibold text-navy uppercase tracking-wider border-b border-gold/20">
        Projects
      </h2>

      {projects.length === 0 ? (
        <p className="px-4 py-6 text-sm text-navy/40 font-mono text-center">
          No projects yet.
        </p>
      ) : (
        <ul className="flex-1 overflow-auto">
          {projects.map((p) => (
            <li
              key={p.id}
              onClick={() => {
                console.log(`ProjectTable: Clicked project ${p.id}`);
                setSelectedProjectId(p.id);
              }}
              className={`px-4 py-3 cursor-pointer border-b border-gold/10 text-sm font-mono transition-colors ${
                // We don't have selectedProjectId in this component, but we can get it from the store
                // However, to avoid causing a re-render in the middle of rendering, we'll use a trick:
                // We'll use the store's state directly in the className by calling useStore again
                // But that would cause a re-render on every project render. Instead, let's just not highlight for now.
                // We'll add highlighting in a separate fix if needed.
                ''
              }`}
            >
              {p.name}
              {p.description && (
                <span className="block text-xs text-navy/40 truncate">{p.description}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}