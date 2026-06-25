"use client";

import type { ReactNode } from "react";
import { ToolPalette } from "@/components/tool-palette";
import type { WorkflowPhase } from "@/lib/workflow-phases";
import type { PlanVersion, WorkspaceTab } from "@/lib/project-types";
import { ReportOutlineSidebar } from "@/components/workflow/ReportOutlineSidebar";
import { VersionTreeSidebar } from "@/components/workflow/VersionTreeSidebar";
import { WorkflowQuickTools } from "@/components/workflow/WorkflowQuickTools";

interface WorkflowLeftSidebarProps {
  phase: WorkflowPhase;
  activeTab: WorkspaceTab;
  versions: PlanVersion[];
  activeVersionId: string;
  compareVersionIds: string[];
  onSelectVersion: (version: PlanVersion) => void;
  onToggleCompare: (versionId: string) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onImportTab: () => void;
  onOpenSheets: () => void;
  onOpenReportEditor?: () => void;
}

export function WorkflowLeftSidebar({
  phase,
  activeTab,
  versions,
  activeVersionId,
  compareVersionIds,
  onSelectVersion,
  onToggleCompare,
  onTabChange,
  onImportTab,
  onOpenSheets,
  onOpenReportEditor
}: WorkflowLeftSidebarProps) {
  let phasePanel: ReactNode = null;

  if (phase === "deliver") {
    phasePanel = <ReportOutlineSidebar onOpenSheets={onOpenSheets} onOpenReportEditor={onOpenReportEditor} />;
  }

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-auto border-r border-line bg-[#0a0f15] p-3">
      <ToolPalette activeTab={activeTab} onImportTab={onImportTab} onTabChange={onTabChange} />
      <VersionTreeSidebar
        versions={versions}
        activeVersionId={activeVersionId}
        compareVersionIds={compareVersionIds}
        onSelectVersion={onSelectVersion}
        onToggleCompare={onToggleCompare}
      />
      {phasePanel}
      <WorkflowQuickTools phase={phase} />
    </aside>
  );
}
