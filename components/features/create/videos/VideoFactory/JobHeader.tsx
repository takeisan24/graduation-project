/**
 * Job Header Component
 * Displays job basic info and status
 */

'use client';

import { JobStatus } from './JobDetailPage';

interface JobHeaderProps {
  job: {
    id: string;
    status: JobStatus;
    progress: number;
    progressMessage: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  };
  onClose?: () => void;
}

export function JobHeader({ job, onClose }: JobHeaderProps) {
  // Map job status -> color. Include all lifecycle states, including system-abandoned.
  const statusColors: Record<JobStatus, string> = {
    pending: 'text-yellow-600',
    running: 'text-blue-600',
    completed: 'text-green-600',
    failed: 'text-red-600',
    paused: 'text-gray-600',
    cancelled: 'text-gray-500',
    abandoned: 'text-orange-600',
  };

  // Map job status -> human-readable label for UI.
  const statusLabels: Record<JobStatus, string> = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    paused: 'Paused',
    cancelled: 'Cancelled',
    abandoned: 'Abandoned (system)',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Job Details</h2>
          <p className="text-sm text-muted-foreground">ID: {job.id}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className={`font-medium ${statusColors[job.status]}`}>
          {statusLabels[job.status]}
        </div>
        {job.status === 'running' && (
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{job.progress}%</span>
            </div>
            {job.progressMessage && (
              <p className="mt-1 text-sm text-muted-foreground">{job.progressMessage}</p>
            )}
          </div>
        )}
      </div>

      {job.errorMessage && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {job.errorMessage}
        </div>
      )}

      <div className="flex gap-4 text-xs text-muted-foreground">
        <div>Created: {new Date(job.createdAt).toLocaleString()}</div>
        <div>Updated: {new Date(job.updatedAt).toLocaleString()}</div>
      </div>
    </div>
  );
}

