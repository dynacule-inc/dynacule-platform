/**
 * Jobs API client — communicates with the unified jobs endpoint.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface JobSummary {
  id: number;
  type: string;
  status: string;
  progress: number;
  error?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
}

export interface JobListResponse {
  total: number;
  limit: number;
  offset: number;
  jobs: JobSummary[];
}

export interface JobStats {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
}

export interface JobDetail extends JobSummary {
  job_id?: string;
  result?: unknown;
}

class JobApiService {
  async listJobs(params?: {
    status?: string;
    jobType?: string;
    limit?: number;
    offset?: number;
  }): Promise<JobListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.jobType) query.set('job_type', params.jobType);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const qs = query.toString();
    const url = `${API_BASE}/jobs/${qs ? `?${qs}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch jobs failed: ${res.status}`);
    return res.json();
  }

  async getStats(): Promise<JobStats> {
    const res = await fetch(`${API_BASE}/jobs/stats`);
    if (!res.ok) throw new Error(`Fetch job stats failed: ${res.status}`);
    return res.json();
  }

  async getJob(jobId: number): Promise<JobDetail> {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Fetch job failed: ${res.status}`);
    return res.json();
  }
}

export const jobApi = new JobApiService();