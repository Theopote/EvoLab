"use client";

import { FloorPlan } from "@/components/floor-plan";
import { ExplodeSlider } from "@/components/viewer-3d/ExplodeSlider";
import { Scene } from "@/components/viewer-3d/Scene";
import type { PlanVersion } from "@/lib/project-types";

interface SchemeSplitViewportProps {
  activeVersion?: PlanVersion;
  activeLevelId?: string;
  onLevelChange: (levelId: string) => void;
  onInpaintRevision?: (version: PlanVersion, prompt: string) => void;
}

export function SchemeSplitViewport({
  activeVersion,
  activeLevelId,
  onLevelChange,
  onInpaintRevision
}: SchemeSplitViewportProps) {
  if (!activeVersion) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate or select a plan version to open the 2D / 3D split viewport.
      </div>
    );
  }

  return (
    <section className="grid min-h-[560px] grid-rows-[auto_minmax(0,1fr)] gap-3 rounded border border-line bg-panel/90 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-white">Scheme Split View</h1>
          <p className="mt-1 text-xs text-muted">2D plan edits sync live with the 3D massing preview.</p>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid min-h-0 gap-3 lg:grid-cols-2">
        <article className="min-h-[420px] overflow-hidden rounded border border-line bg-[#0b1118] p-2">
          <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">2D Plan</div>
          <FloorPlan
            levelId={activeLevelId}
            version={activeVersion}
            onInpaintRevision={onInpaintRevision}
          />
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
    </section>
  );
}
