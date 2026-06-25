"use client";

import { BriefForm } from "@/components/plan-editor/BriefForm";
import { PlanResultGrid } from "@/components/plan-editor/PlanResultGrid";
import { TypologyPackPanel } from "@/components/program/TypologyPackPanel";
import { ProgramCompliancePanel } from "@/components/quantity/ProgramCompliancePanel";
import type { ProgramModel } from "@/lib/building-domain";
import { useProjectActions } from "@/lib/project-store";
import type { DesignBrief, PlanVersion, Point } from "@/lib/project-types";
import type { ZoningConstraints } from "@/lib/site-types";

interface ProgramWorkspaceProps {
  brief: DesignBrief;
  program: ProgramModel;
  outline: Point[];
  outlineClosed: boolean;
  zoning: ZoningConstraints;
  versions: PlanVersion[];
  activeVersionId: string;
  activeVersion?: PlanVersion;
  onBriefChange: (brief: DesignBrief) => void;
  onGenerated: (versions: PlanVersion[]) => void;
  onSelectVersion: (version: PlanVersion) => void;
}

export function ProgramWorkspace({
  brief,
  program,
  outline,
  outlineClosed,
  zoning,
  versions,
  activeVersionId,
  activeVersion,
  onBriefChange,
  onGenerated,
  onSelectVersion
}: ProgramWorkspaceProps) {
  const { setProjectTypology } = useProjectActions();

  return (
    <section className="grid min-h-full grid-rows-[minmax(0,1fr)_minmax(280px,0.75fr)] gap-4">
      <div className="grid min-h-0 grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] gap-4">
        <div className="space-y-4 overflow-auto">
          <TypologyPackPanel variant="embedded" showBriefPreview={false} />
          <BriefForm value={brief} onChange={onBriefChange} onTypologyChange={setProjectTypology} />
          <ProgramSpacesPanel program={program} />
        </div>
        <ProgramCompliancePanel program={program} activeVersion={activeVersion} />
      </div>

      <PlanResultGrid
        outline={outline}
        closed={outlineClosed}
        brief={brief}
        program={program}
        zoning={zoning}
        versions={versions}
        activeVersionId={activeVersionId}
        onGenerated={onGenerated}
        onSelectVersion={onSelectVersion}
      />
    </section>
  );
}

function ProgramSpacesPanel({ program }: { program: ProgramModel }) {
  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-white">Functional program</h2>
        <p className="mt-1 text-xs text-muted">
          {program.label} · {program.spaces.length} spaces from typology and topology
        </p>
      </div>
      <div className="max-h-72 space-y-2 overflow-auto">
        {program.spaces.map((space) => (
          <div className="rounded border border-line bg-[#0b1118] p-2 text-xs" key={space.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-100">{space.name}</span>
              <span className="text-[10px] uppercase tracking-[0.1em] text-muted">{space.priority}</span>
            </div>
            <div className="mt-1 text-muted">
              {space.roomType} · {space.zone}
              {space.targetAreaSqm ? ` · ${space.targetAreaSqm} sqm` : ""}
              {space.count && space.count > 1 ? ` · ×${space.count}` : ""}
            </div>
            {space.adjacencyRules?.length ? (
              <div className="mt-1 text-[11px] text-slate-400">
                {space.adjacencyRules.length} adjacency rule{space.adjacencyRules.length === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
