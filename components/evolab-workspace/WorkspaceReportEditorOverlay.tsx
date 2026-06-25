"use client";

import { memo } from "react";
import { ReportEditor } from "@/components/report-editor/ReportEditor";
import { useProjectState, useSiteState } from "@/lib/project-store";

interface WorkspaceReportEditorOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const WorkspaceReportEditorOverlay = memo(function WorkspaceReportEditorOverlay({
  open,
  onClose
}: WorkspaceReportEditorOverlayProps) {
  const { project, activeVersion, brief } = useProjectState((state) => ({
    project: state.project,
    activeVersion: state.activeVersion,
    brief: state.brief
  }));
  const { siteContext, buildableEnvelope, environmentSurrogate, outline } = useSiteState((state) => ({
    siteContext: state.siteContext,
    buildableEnvelope: state.buildableEnvelope,
    environmentSurrogate: state.environmentSurrogate,
    outline: state.outline
  }));

  if (!open || !activeVersion) {
    return null;
  }

  return (
    <ReportEditor
      project={project}
      version={activeVersion}
      brief={brief}
      siteContext={siteContext}
      envelope={buildableEnvelope}
      environmentSurrogate={environmentSurrogate}
      outline={outline}
      onClose={onClose}
    />
  );
});
