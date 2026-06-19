"use client";

import { Columns3, Layers3 } from "lucide-react";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { VerticalAlignmentPanel } from "@/components/workflow/VerticalAlignmentPanel";
import { StructureOverlayLayer } from "@/components/workflow/layers/StructureOverlayLayer";
import type { StoreyStack, StructuralSystem, VerticalCirculationSystem } from "@/lib/building-domain";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion } from "@/lib/project-types";

interface StructureWorkspaceProps {
  version?: PlanVersion;
  activeLevelId?: string;
  structuralSystem?: StructuralSystem;
  storeyStack?: StoreyStack;
  verticalCirculation?: VerticalCirculationSystem;
  onLevelChange: (levelId: string) => void;
  onInpaintRevision?: (version: PlanVersion, prompt: string) => void;
}

export function StructureWorkspace({
  version,
  activeLevelId,
  structuralSystem,
  storeyStack,
  verticalCirculation,
  onLevelChange,
  onInpaintRevision
}: StructureWorkspaceProps) {
  if (!version) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate or select a plan version to inspect structural grid and vertical alignment.
      </div>
    );
  }

  const activeLevel = version.levels.find((level) => level.id === activeLevelId) ?? version.levels[0];
  const resolvedLevel = activeLevel ? getResolvedLevel(version, activeLevel.id) : undefined;
  const levelColumns = structuralSystem?.columns.filter((column) => column.levelId === activeLevel?.id).length ?? 0;

  return (
    <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)_minmax(220px,0.55fr)] gap-4">
      <header className="rounded border border-line bg-panel/90 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold text-white">
              <Columns3 className="h-4 w-4 text-accent" />
              Structure
            </h1>
            <p className="mt-1 text-xs text-muted">
              Grid-derived columns, storey stack, and vertical core alignment from the active scheme.
            </p>
          </div>
          {version.levels.length > 1 ? (
            <select
              className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
              value={activeLevel?.id}
              onChange={(event) => onLevelChange(event.target.value)}
            >
              {version.levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)] gap-4">
        <aside className="space-y-3 overflow-auto">
          <MetricCard label="Grid spacing" value={`${structuralSystem?.gridSpacingMeters.toFixed(1) ?? "—"} m`} />
          <MetricCard label="Max span" value={`${structuralSystem?.maxSpanMeters.toFixed(1) ?? "—"} m`} />
          <MetricCard label="Columns (level)" value={String(levelColumns)} />
          <MetricCard label="Total columns" value={String(structuralSystem?.columns.length ?? 0)} />
          <MetricCard label="Storey groups" value={String(storeyStack?.groups.length ?? 0)} />
          <MetricCard label="Building height" value={`${storeyStack?.totalHeightMeters.toFixed(1) ?? "—"} m`} />
          <MetricCard label="Stair runs" value={String(verticalCirculation?.stairRuns.length ?? 0)} />
          <MetricCard label="Elevator groups" value={String(verticalCirculation?.elevatorGroups.length ?? 0)} />

          {storeyStack?.groups.length ? (
            <section className="rounded border border-line bg-[#0b1118] p-3 text-xs">
              <div className="mb-2 flex items-center gap-2 font-medium text-white">
                <Layers3 className="h-3.5 w-3.5 text-accent" />
                Storey stack
              </div>
              <div className="space-y-2">
                {storeyStack.groups.map((group) => (
                  <div className="rounded border border-line p-2" key={group.id}>
                    <div className="text-slate-100">{group.label}</div>
                    <div className="mt-1 text-muted">{group.levelIds.length} level(s)</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>

        <section className="min-h-[420px] overflow-hidden rounded border border-line bg-[#0b1118]">
          <svg className="h-full w-full" viewBox={getViewBox(version)}>
            <OutlineLayer version={version} />
            {resolvedLevel ? <RoomFillLayer rooms={resolvedLevel.rooms} /> : null}
            <GridLayer version={version} />
            <StructureOverlayLayer structuralSystem={structuralSystem} levelId={activeLevel?.id} />
          </svg>
        </section>
      </div>

      <VerticalAlignmentPanel
        version={version}
        activeLevelId={activeLevel?.id}
        onApplyRevision={onInpaintRevision}
      />
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel/90 px-3 py-2 text-xs">
      <div className="text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
