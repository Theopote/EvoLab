"use client";

import { ArrowRight } from "lucide-react";
import type { WorkflowPhase } from "@/lib/workflow-phases";

interface WorkflowNextStepBannerProps {
  label: string;
  description: string;
  targetPhase: WorkflowPhase;
  currentPhase: WorkflowPhase;
  onGoToPhase: (phase: WorkflowPhase) => void;
}

export function WorkflowNextStepBanner({
  label,
  description,
  targetPhase,
  currentPhase,
  onGoToPhase
}: WorkflowNextStepBannerProps) {
  if (targetPhase === currentPhase) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-accent/20 bg-accent/5 px-4 py-2">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.14em] text-accent">Suggested next step</div>
        <div className="mt-0.5 truncate text-sm text-slate-100">
          {label}
          <span className="mx-2 text-muted">·</span>
          <span className="text-muted">{description}</span>
        </div>
      </div>
      <button
        className="flex shrink-0 items-center gap-1 rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:border-accent"
        type="button"
        onClick={() => onGoToPhase(targetPhase)}
      >
        Go to {label}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
