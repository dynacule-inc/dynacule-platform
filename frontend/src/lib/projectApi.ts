/**
 * Project API client — communicates with the FastAPI backend.
 */

import { apiBase } from './apiBase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || apiBase();

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

interface RawProject {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
}

class ProjectApiService {
  async fetchProjects(): Promise<Project[]> {
    const url = `${API_BASE}/projects/`;
    console.log('ProjectApiService: Fetching from', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch projects failed: ${res.status}`);
    const data: RawProject[] = await res.json();
    return data.map((p) => ({
      id: String(p.id),
      name: p.name,
      description: p.description,
      created_at: p.created_at,
    }));
  }
}

export const projectApi = new ProjectApiService();