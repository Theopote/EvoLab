"use client";

import { memo, useCallback } from "react";
import { CopilotConsole } from "@/components/copilot/CopilotConsole";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import type { PlanVersion } from "@/lib/project-types";
import { useExportActions, useProjectActions, useProjectState, useSiteState } from "@/lib/project-store";

export const WorkspaceCopilotDock = memo(function WorkspaceCopilotDock() {
  const { project, activeVersion, activeTab } = useProjectState((state) => ({
    project: state.project,
    activeVersion: state.activeVersion,
    activeTab: state.activeTab
  }));
  const outline = useSiteState((state) => state.outline);
  const { appendGeneratedVersions, setActiveVersion, setActiveTab } = useProjectActions();
  const { returnToPlanGeneration } = useExportActions();

  const handleAnalyzedVersion = useCallback(
    (version: PlanVersion, source: { fileName: string; prompt?: string }) => {
      const parent = activeVersion;
      appendGeneratedVersions([version]);

      if (parent) {
        useCopilotTimelineStore.getState().addEntry({
          prompt: source.prompt ?? `Recognize plan from ${source.fileName}`,
          parentVersionId: parent.id,
          parentVersionLabel: parent.label,
          resultVersionId: version.id,
          resultVersionLabel: version.label
        });
      }
    },
    [activeVersion, appendGeneratedVersions]
  );

  return (
    <CopilotConsole
      projectVersions={project.versions}
      activeVersion={activeVersion}
      activeTab={activeTab}
      outline={outline}
      projectType={project.projectType}
      onAnalyzedVersion={handleAnalyzedVersion}
      onSelectVersion={setActiveVersion}
      onTabChange={setActiveTab}
      onRegeneratePlan={returnToPlanGeneration}
    />
  );
});
