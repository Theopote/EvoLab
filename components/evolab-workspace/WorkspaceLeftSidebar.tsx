"use client";

import { memo } from "react";
import { WorkflowLeftSidebar } from "@/components/workflow/WorkflowLeftSidebar";
import { tabForDeliverSubview } from "@/lib/workflow-phases";
import { useProjectActions, useProjectState } from "@/lib/project-store";

interface WorkspaceLeftSidebarProps {
  onOpenReportEditor: () => void;
}

export const WorkspaceLeftSidebar = memo(function WorkspaceLeftSidebar({
  onOpenReportEditor
}: WorkspaceLeftSidebarProps) {
  const { project, compareVersionIds, workflowPhase, activeTab } = useProjectState((state) => ({
    project: state.project,
    compareVersionIds: state.compareVersionIds,
    workflowPhase: state.workflowPhase,
    activeTab: state.activeTab
  }));
  const { setActiveVersion, toggleCompareVersion, setActiveTab, setWorkflowPhase } = useProjectActions();

  return (
    <WorkflowLeftSidebar
      phase={workflowPhase}
      activeTab={activeTab}
      versions={project.versions}
      activeVersionId={project.activeVersionId}
      compareVersionIds={compareVersionIds}
      onSelectVersion={setActiveVersion}
      onToggleCompare={toggleCompareVersion}
      onTabChange={setActiveTab}
      onImportTab={() => {
        setWorkflowPhase("import");
        setActiveTab("Import");
      }}
      onOpenSheets={() => {
        setWorkflowPhase("deliver");
        setActiveTab(tabForDeliverSubview("presentation"));
      }}
      onOpenReportEditor={onOpenReportEditor}
    />
  );
});
