"use client";

import { memo } from "react";
import { TopNav } from "@/components/top-nav";
import { PhaseSubNav } from "@/components/workflow/PhaseSubNav";
import { useProjectActions, useProjectState } from "@/lib/project-store";

export const WorkspaceTopChrome = memo(function WorkspaceTopChrome() {
  const { project, workflowPhase, activeTab } = useProjectState((state) => ({
    project: state.project,
    workflowPhase: state.workflowPhase,
    activeTab: state.activeTab
  }));
  const { setWorkflowPhase, setActiveTab } = useProjectActions();

  return (
    <>
      <TopNav
        project={project}
        workflowPhase={workflowPhase}
        onPhaseChange={setWorkflowPhase}
        onOpenReviews={() => {
          setWorkflowPhase("analyze");
          setActiveTab("Review");
        }}
      />
      <PhaseSubNav phase={workflowPhase} activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
});
