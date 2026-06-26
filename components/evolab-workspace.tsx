"use client";

import { useState } from "react";
import { WorkspaceBottomDock } from "@/components/evolab-workspace/WorkspaceBottomDock";
import { WorkspaceCopilotDock } from "@/components/evolab-workspace/WorkspaceCopilotDock";
import { WorkspaceInspectorRail } from "@/components/evolab-workspace/WorkspaceInspectorRail";
import { WorkspaceLeftSidebar } from "@/components/evolab-workspace/WorkspaceLeftSidebar";
import { WorkspaceMainViewport } from "@/components/evolab-workspace/WorkspaceMainViewport";
import { WorkspaceReportEditorOverlay } from "@/components/evolab-workspace/WorkspaceReportEditorOverlay";
import { WorkspaceTopChrome } from "@/components/evolab-workspace/WorkspaceTopChrome";
import { WorkspaceViewportFrame } from "@/components/evolab-workspace/WorkspaceViewportFrame";

export function EvoLabWorkspace() {
  const [reportEditorOpen, setReportEditorOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <WorkspaceTopChrome />
      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] overflow-hidden">
        <div className="grid min-h-0 grid-cols-[260px_minmax(0,1fr)_minmax(48px,300px)] overflow-hidden">
          <WorkspaceLeftSidebar onOpenReportEditor={() => setReportEditorOpen(true)} />
          <WorkspaceViewportFrame>
            <WorkspaceMainViewport />
          </WorkspaceViewportFrame>
          <WorkspaceInspectorRail />
        </div>
        <WorkspaceCopilotDock />
        <WorkspaceBottomDock />
      </section>
      <WorkspaceReportEditorOverlay open={reportEditorOpen} onClose={() => setReportEditorOpen(false)} />
    </main>
  );
}
