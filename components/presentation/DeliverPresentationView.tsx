"use client";

import { useEffect, useState } from "react";
import { PresentationWorkspace } from "@/components/presentation/PresentationWorkspace";
import { RenderBriefPanel } from "@/components/presentation/RenderBriefPanel";
import { VersionCompareGrid } from "@/components/version-compare/VersionCompareGrid";
import { usePresentationUiStore } from "@/lib/presentation-ui-store";
import type { ProgramModel, ProjectDomain } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";
import type { WorkspaceTab } from "@/lib/project-types";

export type PresentationWorkspaceSection = "report" | "compare" | "render";

interface DeliverPresentationViewProps {
  activeTab: WorkspaceTab;
  activeVersion?: PlanVersion;
  versions: PlanVersion[];
  activeVersionId: string;
  compareLevelId?: string;
  domain: ProjectDomain;
  program: ProgramModel;
  projectType: string;
  orientationDeg?: number;
  onCompareLevelChange: (levelId: string) => void;
  onSelectVersion: (version: PlanVersion) => void;
  onGenerateModel: (version: PlanVersion) => void;
  onRefineVersion: (version: PlanVersion) => void;
}

const sections: { id: PresentationWorkspaceSection; label: string }[] = [
  { id: "report", label: "Report deck" },
  { id: "compare", label: "Scheme compare" },
  { id: "render", label: "Render brief" }
];

function defaultSectionForTab(activeTab: WorkspaceTab): PresentationWorkspaceSection {
  if (activeTab === "Render") {
    return "render";
  }

  return "report";
}

export function DeliverPresentationView({
  activeTab,
  activeVersion,
  versions,
  activeVersionId,
  compareLevelId,
  domain,
  program,
  projectType,
  orientationDeg,
  onCompareLevelChange,
  onSelectVersion,
  onGenerateModel,
  onRefineVersion
}: DeliverPresentationViewProps) {
  const focusSlideId = usePresentationUiStore((state) => state.focusSlideId);
  const [section, setSection] = useState<PresentationWorkspaceSection>(() => defaultSectionForTab(activeTab));

  useEffect(() => {
    setSection(defaultSectionForTab(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (focusSlideId) {
      setSection("report");
    }
  }, [focusSlideId]);

  return (
    <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded border border-line bg-panel/90 p-2">
        <span className="mr-1 text-[11px] uppercase tracking-[0.14em] text-muted">Presentation</span>
        {sections.map((item) => (
          <button
            className={`h-8 rounded px-3 text-xs ${
              section === item.id
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-white/[0.04] hover:text-slate-100"
            }`}
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === "report" ? <PresentationWorkspace /> : null}

      {section === "compare" ? (
        <VersionCompareGrid
          versions={versions}
          activeVersionId={activeVersionId}
          compareLevelId={compareLevelId}
          domain={domain}
          program={program}
          projectType={projectType}
          orientationDeg={orientationDeg}
          onCompareLevelChange={onCompareLevelChange}
          onSelectVersion={onSelectVersion}
          onGenerateModel={onGenerateModel}
          onRefineVersion={onRefineVersion}
        />
      ) : null}

      {section === "render" ? (
        <RenderBriefPanel activeVersion={activeVersion} projectType={projectType} />
      ) : null}
    </section>
  );
}
