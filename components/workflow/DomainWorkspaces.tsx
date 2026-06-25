"use client";

import type { ProgramModel } from "@/lib/building-domain";
import type { DesignBrief, PlanVersion, Point } from "@/lib/project-types";
import { BriefForm } from "@/components/plan-editor/BriefForm";
import { OutlineCanvas } from "@/components/plan-editor/OutlineCanvas";
import { ProgramCompliancePanel } from "@/components/quantity/ProgramCompliancePanel";
import { ScoringConfigPanel } from "@/components/score/ScoringConfigPanel";
import { SiteContextPanel } from "@/components/site/SiteContextPanel";
import type { ProjectDomain, ScoringConfig } from "@/lib/building-domain";

interface SiteWorkspaceProps {
  outline: Point[];
  outlineClosed: boolean;
  onOutlineChange: (outline: Point[]) => void;
  onOutlineClosedChange: (closed: boolean) => void;
}

export function SiteWorkspace({
  outline,
  outlineClosed,
  onOutlineChange,
  onOutlineClosedChange
}: SiteWorkspaceProps) {
  return (
    <section className="grid min-h-full grid-cols-[360px_minmax(0,1fr)] gap-4">
      <OutlineCanvas
        points={outline}
        closed={outlineClosed}
        onChange={onOutlineChange}
        onClosedChange={onOutlineClosedChange}
      />
      <div className="rounded border border-line bg-panel/90 p-4">
        <h1 className="text-base font-semibold text-white">Site envelope</h1>
        <p className="mt-1 text-xs text-muted">
          Define the site boundary, orientation, and zoning context before generating schemes.
        </p>
        <div className="mt-4">
          <SiteContextPanel />
        </div>
      </div>
    </section>
  );
}

interface ProgramWorkspaceProps {
  brief: DesignBrief;
  program: ProgramModel;
  domain: ProjectDomain;
  projectType: string;
  activeVersion?: PlanVersion;
  onBriefChange: (brief: DesignBrief) => void;
  onScoringConfigChange: (patch: Partial<ScoringConfig>) => void;
  onScoringConfigReset: () => void;
}

export function ProgramWorkspace({
  brief,
  program,
  domain,
  projectType,
  activeVersion,
  onBriefChange,
  onScoringConfigChange,
  onScoringConfigReset
}: ProgramWorkspaceProps) {
  return (
    <section className="grid min-h-full grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)] gap-4">
      <div className="space-y-4">
        <div className="rounded border border-line bg-panel/90 p-4">
          <h1 className="mb-4 text-base font-semibold text-white">Design brief</h1>
          <BriefForm value={brief} onChange={onBriefChange} />
        </div>
        <ScoringConfigPanel
          domain={domain}
          projectType={projectType}
          onChange={onScoringConfigChange}
          onReset={onScoringConfigReset}
        />
      </div>
      <ProgramCompliancePanel program={program} activeVersion={activeVersion} />
    </section>
  );
}

interface FacadePreviewPanelProps {
  facade?: ProjectDomain["facadeEnvelope"];
}

export function FacadePreviewPanel({ facade }: FacadePreviewPanelProps) {
  const zones = facade?.zones ?? [];

  return (
    <section className="rounded border border-line bg-panel/90 p-6">
      <h2 className="text-base font-semibold text-white">Facade envelope</h2>
      <p className="mt-2 text-sm text-muted">Derived from active plan levels and orientation strategy.</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted">Default window ratio</dt>
          <dd className="mt-1 text-slate-100">{((facade?.defaultWindowRatio ?? 0) * 100).toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="text-muted">Orientation strategy</dt>
          <dd className="mt-1 text-slate-100">{facade?.orientationStrategy ?? "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Facade zones</dt>
          <dd className="mt-2 space-y-2">
            {zones.length ? (
              zones.map((zone) => (
                <div className="rounded border border-line bg-[#0b1118] px-3 py-2" key={zone.id}>
                  <div className="font-medium text-slate-100">{zone.edge.toUpperCase()} · {zone.strategy.replace("_", " ")}</div>
                  <div className="mt-1 text-muted">
                    Level {zone.levelId ?? "all"} · target {(zone.targetWindowRatio ?? facade?.defaultWindowRatio ?? 0) * 100}%
                  </div>
                </div>
              ))
            ) : (
              <span className="text-muted">Generate or select a plan to derive facade zones.</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

interface StructurePreviewPanelProps {
  structure?: ProjectDomain["structuralSystem"];
  levelCount?: number;
}

export function StructurePreviewPanel({ structure, levelCount }: StructurePreviewPanelProps) {
  return (
    <section className="rounded border border-line bg-panel/90 p-6">
      <h2 className="text-base font-semibold text-white">Structural system</h2>
      <p className="mt-2 text-sm text-muted">Grid spacing and column stack derived from the active plan.</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted">Grid spacing</dt>
          <dd className="mt-1 text-slate-100">{structure ? `${structure.gridSpacingMeters.toFixed(1)} m` : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Max span</dt>
          <dd className="mt-1 text-slate-100">{structure ? `${structure.maxSpanMeters.toFixed(1)} m` : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Columns</dt>
          <dd className="mt-1 text-slate-100">{structure?.columns.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted">Levels</dt>
          <dd className="mt-1 text-slate-100">{levelCount ?? 0}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted">Shear walls</dt>
          <dd className="mt-1 text-slate-100">{structure?.shearWalls.length ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
}
