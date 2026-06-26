"use client";

import { History, RotateCcw, Undo2 } from "lucide-react";
import type { PlanVersion } from "@/lib/project-types";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";

interface AiTimelinePanelProps {
  versions: PlanVersion[];
  activeVersionId: string;
  onUndo: (entryId: string, parentVersionId: string, changeSetId?: string) => void;
  onRegenerate: (prompt: string, parentVersionId: string) => void;
}

export function AiTimelinePanel({ versions, activeVersionId, onUndo, onRegenerate }: AiTimelinePanelProps) {
  const entries = useCopilotTimelineStore((state) => state.entries);

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col rounded border border-line bg-[#0b1118] p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          <History className="h-3.5 w-3.5" />
          AI Timeline
        </div>
        <p className="text-xs leading-5 text-muted">
          Each Copilot edit will appear here with undo and regenerate controls.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded border border-line bg-[#0b1118]">
      <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5" />
          AI Timeline
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-2">
        {entries.map((entry) => {
          const isActive = entry.resultVersionId === activeVersionId;
          const parentExists = versions.some((version) => version.id === entry.parentVersionId);
          const canUndo = entry.status === "applied" && (Boolean(entry.changeSetId) || parentExists);

          return (
            <article
              className={`rounded border p-2 ${
                isActive ? "border-accent/50 bg-accent/10" : "border-line bg-panel/70"
              }`}
              key={entry.id}
            >
              <div className="text-[11px] text-muted">{new Date(entry.createdAt).toLocaleString()}</div>
              <div className="mt-1 text-xs text-slate-100">{entry.prompt}</div>
              <div className="mt-1 text-[11px] text-muted">
                {entry.parentVersionLabel} → {entry.resultVersionLabel}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">{entry.status}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
                  disabled={!canUndo}
                  type="button"
                  onClick={() => onUndo(entry.id, entry.parentVersionId, entry.changeSetId)}
                >
                  <Undo2 className="h-3 w-3" />
                  Undo
                </button>
                <button
                  className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
                  disabled={!parentExists}
                  type="button"
                  onClick={() => onRegenerate(entry.prompt, entry.parentVersionId)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
