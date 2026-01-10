/**
 * Step Row Component
 * Displays individual step with status and retry button
 */

'use client';

import { JobStep, StepStatus } from './JobDetailPage';
import { CheckCircle2, XCircle, Clock, PlayCircle, Minus } from 'lucide-react';

interface StepRowProps {
  step: JobStep;
  onRetry: (stepName: string) => void;
  onResume?: () => void;
}

const stepLabels: Record<string, string> = {
  ingest: 'Ingest Video',
  audio_extract: 'Extract Audio',
  transcribe: 'Transcribe',
  ai_magic: 'AI Segment Selection',
  cut: 'Cut Clips',
  postprocess: 'Post-Process',
  thumbnail: 'Generate Thumbnails',
  cleanup: 'Cleanup',
};

export function StepRow({ step, onRetry, onResume }: StepRowProps) {
  const canRetry = step.status === 'failed' && step.error?.retryable === true;

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <PlayCircle className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'waiting':
        return <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'skipped':
        return <Minus className="h-4 w-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-blue-600';
      case 'waiting':
        return 'text-yellow-600';
      case 'pending':
        return 'text-gray-400';
      case 'skipped':
        return 'text-gray-400';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      {/* Status Icon */}
      <div className="flex-shrink-0">{getStatusIcon(step.status)}</div>

      {/* Step Info */}
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{stepLabels[step.name] || step.name}</span>
          <span className={`text-xs ${getStatusColor(step.status)}`}>
            {step.status}
          </span>
          {step.attempt > 1 && (
            <span className="text-xs text-muted-foreground">
              (Attempt {step.attempt})
            </span>
          )}
        </div>

        {/* Error Message (only show for failed steps, not waiting) */}
        {step.error && step.status === 'failed' && (
          <div className="text-sm text-destructive">
            <div className="font-medium">Error: {step.error.code}</div>
            <div>{step.error.message}</div>
            {step.error.detail && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs">Details</summary>
                <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(step.error.detail, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Waiting Message (for waiting steps) */}
        {step.status === 'waiting' && step.error && (
          <div className="text-sm text-yellow-600">
            <div className="font-medium">Waiting: {step.error.code === 'WAITING_FOR_RESOURCE' ? 'Waiting for external resource' : step.error.code}</div>
            <div>{step.error.message}</div>
            {step.error.detail && (
              <details className="mt-1">
                <summary className="cursor-pointer text-xs">Details</summary>
                <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(step.error.detail, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Timestamps */}
        {(step.startedAt || step.completedAt) && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {step.startedAt && (
              <div>Started: {new Date(step.startedAt).toLocaleString()}</div>
            )}
            {step.completedAt && (
              <div>Completed: {new Date(step.completedAt).toLocaleString()}</div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {canRetry && (
          <button
            onClick={() => onRetry(step.name)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        )}

        {/* ✅ NEW: "Tiếp tục" (Continue) button for STUCK jobs (running/waiting for too long) */}
        {(step.status === 'running' || step.status === 'waiting') && onResume && (
          <button
            onClick={() => onResume()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-1.5"
            title="Thử bắt đầu lại phần ghép video nếu bị kẹt lâu"
          >
            <PlayCircle className="h-4 w-4" />
            Tiếp tục
          </button>
        )}
      </div>
    </div>
  );
}

