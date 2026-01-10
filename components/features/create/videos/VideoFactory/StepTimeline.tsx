/**
 * Step Timeline Component
 * Displays all steps with their status
 */

'use client';

import { StepRow } from './StepRow';
import { JobStep } from './JobDetailPage';

interface StepTimelineProps {
  steps: JobStep[];
  onRetryStep: (stepName: string) => void;
  onResume?: () => void;
}

export function StepTimeline({ steps, onRetryStep, onResume }: StepTimelineProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Steps</h3>
      <div className="space-y-1">
        {steps.map((step) => (
          <StepRow key={step.name} step={step} onRetry={onRetryStep} onResume={onResume} />
        ))}
      </div>
    </div>
  );
}

