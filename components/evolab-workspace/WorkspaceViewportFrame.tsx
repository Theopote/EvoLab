"use client";

import { memo } from "react";
import { ViewportKpiHud } from "@/components/workflow/ViewportKpiHud";
import { VersionSplitCompare } from "@/components/workflow/VersionSplitCompare";
import { useProjectActions, useProjectState } from "@/lib/project-store";

export const WorkspaceViewportFrame = memo(function WorkspaceViewportFrame({
  children
}: {
  children: React.ReactNode;
}) {
  const { project, compareVersionIds, compareLevelId, compareModeOpen } = useProjectState((state) => ({
    project: state.project,
    compareVersionIds: state.compareVersionIds,
    compareLevelId: state.compareLevelId,
    compareModeOpen: state.compareModeOpen
  }));
  const { setCompareLevel } = useProjectActions();

  return (
    <section className="relative min-h-0 overflow-hidden">
      <ViewportKpiHud />
      <div className="cad-grid h-full overflow-auto p-4">
        {!compareModeOpen ? (
          <VersionSplitCompare
            versions={project.versions}
            compareVersionIds={compareVersionIds}
            compareLevelId={compareLevelId}
            onCompareLevelChange={setCompareLevel}
          />
        ) : null}
        {children}
      </div>
    </section>
  );
});
