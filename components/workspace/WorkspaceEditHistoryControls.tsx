"use client";

import { Undo2, Redo2 } from "lucide-react";
import { useHistoryActions, useHistoryState } from "@/lib/project-store";

export function WorkspaceEditHistoryControls() {
  const { canUndo, canRedo } = useHistoryState();
  const { undoProjectEdit, redoProjectEdit } = useHistoryActions();

  return (
    <div className="flex items-center gap-1">
      <button
        aria-label="撤销"
        className="grid h-8 w-8 place-items-center rounded border border-line text-slate-300 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canUndo}
        title="撤销 (Ctrl+Z)"
        type="button"
        onClick={undoProjectEdit}
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        aria-label="重做"
        className="grid h-8 w-8 place-items-center rounded border border-line text-slate-300 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canRedo}
        title="重做 (Ctrl+Shift+Z)"
        type="button"
        onClick={redoProjectEdit}
      >
        <Redo2 className="h-4 w-4" />
      </button>
    </div>
  );
}
