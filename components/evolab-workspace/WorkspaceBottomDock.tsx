"use client";

import { memo } from "react";
import { BottomPanel } from "@/components/bottom-panel";
import { useAnalysisState, useProjectActions, useProjectState } from "@/lib/project-store";

export const WorkspaceBottomDock = memo(function WorkspaceBottomDock() {
  const { project, activeVersion } = useProjectState((state) => ({
    project: state.project,
    activeVersion: state.activeVersion
  }));
  const { quantities, complianceItems } = useAnalysisState((state) => ({
    quantities: state.quantities,
    complianceItems: state.complianceItems
  }));
  const { setActiveVersion } = useProjectActions();

  return (
    <BottomPanel
      project={project}
      activeVersion={activeVersion}
      quantities={quantities}
      complianceItems={complianceItems}
      onSelectVersion={setActiveVersion}
    />
  );
});
