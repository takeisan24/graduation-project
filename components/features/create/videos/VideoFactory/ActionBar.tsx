/**
 * Action Bar Component
 * Displays resume button and other actions
 */

'use client';

import { JobStatus } from './JobDetailPage';
import { RefreshCw } from 'lucide-react';

interface ActionBarProps {
  jobStatus: JobStatus;
  canResume: boolean;
  onResume: () => void;
  refreshing?: boolean;
}

export function ActionBar({ jobStatus, canResume, onResume, refreshing }: ActionBarProps) {
  // Only show action bar if job is failed and can be resumed
  if (jobStatus !== 'failed' || !canResume) {
    return null;
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/50 p-4">
      <div>
        <h4 className="font-medium">Job Failed</h4>
        <p className="text-sm text-muted-foreground">
          Some steps failed but can be retried. Click Resume to retry failed steps.
        </p>
      </div>
      <button
        onClick={onResume}
        disabled={refreshing}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {refreshing && <RefreshCw className="h-4 w-4 animate-spin" />}
        Resume Job
      </button>
    </div>
  );
}

