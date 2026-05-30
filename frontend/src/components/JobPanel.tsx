'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { jobApi, type JobSummary, type JobDetail } from '@/lib/jobApi';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-400/20 text-amber-600 border-amber-400/30',
  processing: 'bg-blue-400/20 text-blue-600 border-blue-400/30',
  completed: 'bg-green-400/20 text-green-600 border-green-400/30',
  failed: 'bg-red-400/20 text-red-600 border-red-400/30',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'PENDING',
  processing: 'RUNNING',
  completed: 'DONE',
  failed: 'FAILED',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || 'bg-navy/10 text-navy/60 border-navy/20';
  const label = STATUS_LABELS[status] || status.toUpperCase();
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-mono border rounded ${color}`}>
      {label}
    </span>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1 bg-navy/10 rounded-full overflow-hidden">
      <div
        className="h-full bg-gold rounded-full transition-all duration-500"
        style={{ width: `${Math.min(progress, 100)}%` }}
      />
    </div>
  );
}

function JobDetailCard({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    jobApi
      .getJob(jobId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) {
    return (
      <div className="px-4 py-3 text-[10px] font-mono text-navy/40">
        Loading...
      </div>
    );
  }

  if (!detail) return null;

  const resultStr =
    detail.result && typeof detail.result === 'object'
      ? JSON.stringify(detail.result, null, 2)
      : detail.result
        ? String(detail.result)
        : null;

  return (
    <div className="px-4 py-3 bg-navy/5 border-t border-gold/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-navy/60 uppercase tracking-wider">
          Job #{detail.id} Details
        </span>
        <button
          onClick={onClose}
          className="text-[10px] font-mono text-navy/40 hover:text-navy transition-colors"
        >
          Close
        </button>
      </div>

      <div className="space-y-1.5 text-[10px] font-mono">
        <div className="flex justify-between">
          <span className="text-navy/40">Type</span>
          <span className="text-navy">{detail.type}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-navy/40">Status</span>
          <StatusBadge status={detail.status} />
        </div>
        {detail.job_id && (
          <div className="flex justify-between">
            <span className="text-navy/40">Task ID</span>
            <span className="text-navy truncate max-w-[120px]">{detail.job_id}</span>
          </div>
        )}
        {detail.created_at && (
          <div className="flex justify-between">
            <span className="text-navy/40">Created</span>
            <span className="text-navy">{new Date(detail.created_at).toLocaleString()}</span>
          </div>
        )}
        {detail.completed_at && (
          <div className="flex justify-between">
            <span className="text-navy/40">Completed</span>
            <span className="text-navy">{new Date(detail.completed_at).toLocaleString()}</span>
          </div>
        )}
        {detail.error && (
          <div className="mt-2 p-2 bg-red-400/10 border border-red-400/20 rounded text-red-600">
            {detail.error}
          </div>
        )}
      </div>

      {/* Result */}
      {resultStr && (
        <div className="mt-2">
          <span className="block text-[10px] font-mono text-navy/60 uppercase tracking-wider mb-1">
            Result
          </span>
          <pre className="text-[9px] font-mono text-navy/80 bg-cream border border-gold/10 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
            {resultStr}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function JobPanel() {
  const { jobs, setJobs, jobStats, setJobStats, selectedJob, setSelectedJob, setVizCommand } = useStore();
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial data
  useEffect(() => {
    jobApi
      .listJobs({ limit: 50 })
      .then((data) => setJobs(data.jobs))
      .catch(() => {});

    jobApi
      .getStats()
      .then((stats) => setJobStats(stats))
      .catch(() => {});
  }, [setJobs, setJobStats]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL?.replace('/ws/status', '/api/v1/jobs/ws') ||
      `ws://${window.location.hostname}:8000/api/v1/jobs/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'init') {
          // Initial stats snapshot
          return;
        }

        if (data.type === 'job_update' && data.job_id) {
          // Refresh the job list to get updated data
          jobApi.listJobs({ limit: 50 }).then((res) => {
            setJobs(res.jobs);
          });
          jobApi.getStats().then(setJobStats);
        }
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [setJobs, setJobStats]);

  const toggleExpand = useCallback(
    (jobId: number) => {
      setExpandedJobId((prev) => (prev === jobId ? null : jobId));
    },
    []
  );

  return (
    <div className="flex flex-col border-t border-gold/20">
      {/* Header with stats strip */}
      <div className="px-4 py-2 border-b border-gold/20 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy uppercase tracking-wider">
          Jobs
        </h2>
        <div className="flex items-center gap-2">
          {jobStats && (
            <div className="flex gap-1.5 text-[9px] font-mono">
              {jobStats.by_status?.pending > 0 && (
                <span className="text-amber-600">{jobStats.by_status.pending} pending</span>
              )}
              {jobStats.by_status?.processing > 0 && (
                <span className="text-blue-600">{jobStats.by_status.processing} running</span>
              )}
              {jobStats.by_status?.failed > 0 && (
                <span className="text-red-600">{jobStats.by_status.failed} failed</span>
              )}
            </div>
          )}
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              wsConnected ? 'bg-green-400' : 'bg-red-400'
            }`}
          />
        </div>
      </div>

      {/* Job list */}
      {jobs.length === 0 ? (
        <p className="px-4 py-6 text-xs text-navy/40 font-mono text-center">
          No jobs yet. Run a pipeline from the command palette.
        </p>
      ) : (
        <ul className="flex-1 overflow-auto max-h-64">
          {jobs.map((j) => (
            <li key={j.id}>
              <div
                onClick={() => toggleExpand(j.id)}
                className={`px-4 py-2.5 cursor-pointer border-b border-gold/10 transition-colors hover:bg-gold/5 ${
                  selectedJob?.id === j.id ? 'bg-gold/15' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-navy/40">{j.id}</span>
                    <span className="text-[10px] font-mono text-navy/50 uppercase">{j.type}</span>
                    <StatusBadge status={j.status} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {j.status === 'completed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJob(selectedJob?.id === j.id ? null : j);
                        }}
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                          selectedJob?.id === j.id
                            ? 'bg-gold/30 text-navy border-gold/50'
                            : 'text-navy/40 border-transparent hover:text-navy hover:border-gold/30'
                        }`}
                      >
                        Show
                      </button>
                    )}
                    <span className="text-[9px] font-mono text-navy/30">
                      {j.created_at
                        ? new Date(j.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Progress bar for processing jobs */}
                {j.status === 'processing' && <ProgressBar progress={j.progress} />}

                {/* Error message for failed jobs */}
                {j.status === 'failed' && j.error && (
                  <p className="mt-1 text-[9px] font-mono text-red-500 truncate">{j.error}</p>
                )}
              </div>

              {/* Expandable detail card */}
              {expandedJobId === j.id && (
                <JobDetailCard
                  jobId={j.id}
                  onClose={() => setExpandedJobId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}