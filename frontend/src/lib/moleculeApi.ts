/**
 * Molecule API client — communicates with the FastAPI backend.
 */

import { apiBase } from './apiBase';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || apiBase();

export interface MoleculeData {
  id: number;
  name: string;
  smiles?: string;
  formula?: string;
  source: string;
  project_id?: number | null;
  created_at?: string;
}

export interface PdbResponse {
  pdb: string;
  name: string;
  id: number;
}

class MoleculeApiService {
  async listMolecules(projectId?: number): Promise<MoleculeData[]> {
    const params = projectId ? `?project_id=${projectId}` : '';
    const url = `${API_BASE}/molecules/${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch molecules failed: ${res.status}`);
    return res.json();
  }

  async createFromSmiles(smiles: string, name?: string, projectId?: number): Promise<MoleculeData> {
    const formData = new FormData();
    formData.append('smiles', smiles);
    if (name) formData.append('name', name);
    if (projectId) formData.append('project_id', String(projectId));

    const res = await fetch(`${API_BASE}/molecules/smiles`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Create from SMILES failed: ${res.status} — ${err}`);
    }
    return res.json();
  }

  async uploadFile(file: File, name?: string, projectId?: number): Promise<MoleculeData> {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    if (projectId) formData.append('project_id', String(projectId));

    const res = await fetch(`${API_BASE}/molecules/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`File upload failed: ${res.status} — ${err}`);
    }
    return res.json();
  }

  async getPdb(moleculeId: number): Promise<PdbResponse> {
    const url = `${API_BASE}/molecules/${moleculeId}/pdb`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch PDB failed: ${res.status}`);
    return res.json();
  }

  async deleteMolecule(moleculeId: number): Promise<void> {
    const res = await fetch(`${API_BASE}/molecules/${moleculeId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Delete molecule failed: ${res.status}`);
  }
}

export const moleculeApi = new MoleculeApiService();