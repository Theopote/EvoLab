"use client";

import { memo, useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import { ExplodeSlider } from "@/components/viewer-3d/ExplodeSlider";
import { Scene } from "@/components/viewer-3d/Scene";
import { VerticalAlignmentPanel } from "@/components/workflow/VerticalAlignmentPanel";
import { useProjectActions } from "@/lib/project-store";
import { isLevelLinkedToStandardGroup, standardFloorGroupLabel } from "@/lib/standard-floor-group";
import type { PlanVersion } from "@/lib/project-types";

type ViewportMode = "split" | "alignment";

interface SchemeSplitViewportProps {
  activeVersion?: PlanVersion;
  activeLevelId?: string;
  geometryRevision: number;
  onLevelChange: (levelId: string) => void;
}

function schemeSplitViewportPropsEqual(
  previous: SchemeSplitViewportProps,
  next: SchemeSplitViewportProps
) {
  return (
    previous.activeLevelId === next.activeLevelId &&
    previous.geometryRevision === next.geometryRevision &&
    previous.onLevelChange === next.onLevelChange &&
    previous.activeVersion?.id === next.activeVersion?.id &&
    previous.activeVersion?.label === next.activeVersion?.label &&
    previous.activeVersion?.levels.length === next.activeVersion?.levels.length
  );
}

export const SchemeSplitViewport = memo(function SchemeSplitViewport({
  activeVersion,
  activeLevelId,
  onLevelChange
}: SchemeSplitViewportProps) {
  const [viewportMode, setViewportMode] = useState<ViewportMode>("split");
  const { setLevelTransferFloor } = useProjectActions();

  if (!activeVersion) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate or select a plan version to open the 2D / 3D split viewport.
      </div>
    );
  }

  const activeLevel = activeVersion.levels.find((level) => level.id === activeLevelId) ?? activeVersion.levels[0];
  const linkedGroup =
    activeLevel && isLevelLinkedToStandardGroup(activeLevel)
      ? activeVersion.standardFloorGroups?.find((group) => group.id === activeLevel.standardFloorGroupId)
      : undefined;

  return (
    <section className="grid min-h-[560px] grid-rows-[auto_minmax(0,1fr)] gap-3 rounded border border-line bg-panel/90 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-white">Scheme Split View</h1>
          <p className="mt-1 text-xs text-muted">2D plan edits sync live with the 3D massing preview.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-line p-0.5">
            <button
              className={`rounded px-2 py-1 text-xs ${
                viewportMode === "split" ? "bg-accent/20 text-accent" : "text-muted"
              }`}
              type="button"
              onClick={() => setViewportMode("split")}
            >
              Plan / 3D
            </button>
            <button
              className={`rounded px-2 py-1 text-xs ${
                viewportMode === "alignment" ? "bg-accent/20 text-accent" : "text-muted"
              }`}
              type="button"
              onClick={() => setViewportMode("alignment")}
            >
              Vertical alignment
            </button>
          </div>
          {activeVersion.levels.length ? (
            <select
              className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
              value={activeLevelId ?? activeVersion.levels[0]?.id}
              onChange={(event) => onLevelChange(event.target.value)}
            >
              {activeVersion.levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          ) : null}
          <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">{activeVersion.label}</span>
        </div>
      </div>
      {linkedGroup ? (
        <p className="rounded border border-info/40 bg-info/10 px-3 py-2 text-xs text-slate-200">
          Editing standard floor group: {standardFloorGroupLabel(linkedGroup, activeVersion.levels)}. Changes sync to all
          member floors.
        </p>
      ) : null}

      {viewportMode === "alignment" ? (
        <VerticalAlignmentPanel
          version={activeVersion}
          activeLevelId={activeLevelId}
          onMarkTransferFloor={(levelId) => setLevelTransferFloor(levelId, true)}
        />
      ) : (
        <div className="grid min-h-0 gap-3 lg:grid-cols-2">
          <article className="min-h-[420px] overflow-hidden rounded border border-line bg-[#0b1118] p-2">
            <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">2D Plan</div>
            <FloorPlan levelId={activeLevelId} version={activeVersion} />
          </article>
          <article className="min-h-[420px] overflow-hidden rounded border border-line bg-[#081018]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted">3D Model</div>
              <ExplodeSlider className="max-w-xs flex-1" />
            </div>
            <div className="h-[calc(100%-2.75rem)] min-h-[380px]">
              <Scene />
            </div>
          </article>
        </div>
      )}
    </section>
  );
}, schemeSplitViewportPropsEqual);
