import { Cloud, Share2, Sparkles } from "lucide-react";
import { workflowPhaseDefinitions, type WorkflowPhase } from "@/lib/workflow-phases";
import type { ProjectData } from "@/lib/project-types";

interface TopNavProps {
  project: ProjectData;
  workflowPhase: WorkflowPhase;
  onPhaseChange: (phase: WorkflowPhase) => void;
}

export function TopNav({ project, workflowPhase, onPhaseChange }: TopNavProps) {
  return (
    <header className="flex h-14 items-center border-b border-line bg-[#0b1118] px-4">
      <div className="mr-6 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded border border-accent/40 bg-accent/10">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <div>
          <div className="text-sm font-semibold leading-none text-white">EvoLab</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">Workflow Workspace</div>
        </div>
      </div>
      <nav className="flex h-full items-center gap-1">
        {workflowPhaseDefinitions.map((phase) => (
          <button
            className={`h-9 rounded px-3 text-sm transition ${
              workflowPhase === phase.id
                ? "bg-accent/15 text-accent"
                : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
            }`}
            key={phase.id}
            title={phase.description}
            type="button"
            onClick={() => onPhaseChange(phase.id)}
          >
            {phase.label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="max-w-48 truncate text-slate-300">{project.projectName}</span>
        <span className="rounded border border-line px-2 py-1 text-xs text-muted">
          AI Credits 1,240
        </span>
        <span className="flex items-center gap-1 rounded border border-success/30 px-2 py-1 text-xs text-success">
          <Cloud className="h-3.5 w-3.5" />
          Synced
        </span>
        <button
          className="grid h-8 w-8 place-items-center rounded border border-line text-slate-300 hover:border-accent/60 hover:text-accent"
          type="button"
          aria-label="Share"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <div className="grid h-8 w-8 place-items-center rounded bg-slate-700 text-xs font-semibold">
          EV
        </div>
      </div>
    </header>
  );
}
