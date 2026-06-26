import Link from "next/link";
import { Cloud, GitCompareArrows, Home, Share2, Sparkles, Wrench } from "lucide-react";
import { pendingChangeSets } from "@/lib/project-domain";
import { topNavPhaseDefinitions, type WorkflowPhase, type WorkflowPhaseId } from "@/lib/workflow-phases";
import type { ProjectData } from "@/lib/project-types";

interface TopNavProps {
  project: ProjectData;
  workflowPhase: WorkflowPhase;
  onPhaseChange: (phase: WorkflowPhaseId) => void;
  onOpenReviews?: () => void;
}

export function TopNav({ project, workflowPhase, onPhaseChange, onOpenReviews }: TopNavProps) {
  const pendingReviewCount = pendingChangeSets(project.domain).length;

  return (
    <header className="flex h-14 items-center border-b border-line bg-[#0b1118] px-4">
      <Link className="mr-4 flex items-center gap-2" href="/">
        <div className="grid h-8 w-8 place-items-center rounded border border-accent/40 bg-accent/10">
          <Sparkles className="h-4 w-4 text-accent" />
        </div>
        <div className="hidden sm:block">
          <div className="text-sm font-semibold leading-none text-white">EvoLab</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">工作台</div>
        </div>
      </Link>

      <nav className="flex h-full items-center gap-1">
        {topNavPhaseDefinitions.map((phase) => (
          <button
            className={`h-9 rounded px-3 text-sm transition ${
              workflowPhase === phase.id || (phase.id === "analyze" && workflowPhase === "quantify")
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

      <div className="ml-auto flex items-center gap-2 text-sm">
        <Link
          className="hidden rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-accent md:inline-flex"
          href="/tools"
        >
          <Wrench className="mr-1 inline h-3.5 w-3.5" />
          工具箱
        </Link>
        <Link
          className="grid h-8 w-8 place-items-center rounded border border-line text-muted transition hover:border-accent/60 hover:text-accent"
          href="/"
          aria-label="返回首页"
        >
          <Home className="h-4 w-4" />
        </Link>
        <span className="max-w-48 truncate text-slate-300">{project.projectName}</span>
        {pendingReviewCount > 0 ? (
          <button
            className="flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning hover:border-warning"
            type="button"
            onClick={onOpenReviews}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {pendingReviewCount} 待审
          </button>
        ) : null}
        <span className="rounded border border-line px-2 py-1 text-xs text-muted">AI Credits 1,240</span>
        <span className="flex items-center gap-1 rounded border border-success/30 px-2 py-1 text-xs text-success">
          <Cloud className="h-3.5 w-3.5" />
          已同步
        </span>
        <button
          className="grid h-8 w-8 place-items-center rounded border border-line text-slate-300 hover:border-accent/60 hover:text-accent"
          type="button"
          aria-label="Share"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <div className="grid h-8 w-8 place-items-center rounded bg-slate-700 text-xs font-semibold">EV</div>
      </div>
    </header>
  );
}
