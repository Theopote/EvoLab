"use client";

import { Armchair } from "lucide-react";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { FurnitureOverlayLayer } from "@/components/workflow/layers/FurnitureOverlayLayer";
import type { FurnitureLayout } from "@/lib/building-domain";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion } from "@/lib/project-types";

interface FurnitureWorkspaceProps {
  version?: PlanVersion;
  activeLevelId?: string;
  furnitureLayout?: FurnitureLayout;
  onLevelChange: (levelId: string) => void;
}

export function FurnitureWorkspace({ version, activeLevelId, furnitureLayout, onLevelChange }: FurnitureWorkspaceProps) {
  if (!version) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate or select a plan version to preview furniture placement by room type.
      </div>
    );
  }

  const activeLevel = version.levels.find((level) => level.id === activeLevelId) ?? version.levels[0];
  const resolvedLevel = activeLevel ? getResolvedLevel(version, activeLevel.id) : undefined;
  const levelItems = furnitureLayout?.items.filter((item) => item.levelId === activeLevel?.id) ?? [];
  const categoryCounts = levelItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="grid min-h-full grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] gap-4">
      <div className="space-y-4 overflow-auto">
        <header className="rounded border border-line bg-panel/90 p-3">
          <h1 className="flex items-center gap-2 text-base font-semibold text-white">
            <Armchair className="h-4 w-4 text-accent" />
            Furniture layout
          </h1>
          <p className="mt-1 text-xs text-muted">
            Auto-placed from room types on the active scheme. {furnitureLayout?.items.length ?? 0} items total.
          </p>
        </header>

        {version.levels.length > 1 ? (
          <select
            className="h-8 w-full rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
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

        <section className="rounded border border-line bg-panel/90 p-3">
          <h2 className="mb-2 text-sm font-semibold text-white">Level summary</h2>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Items" value={String(levelItems.length)} />
            {Object.entries(categoryCounts).map(([category, count]) => (
              <Metric key={category} label={category} value={String(count)} />
            ))}
          </dl>
        </section>

        <section className="max-h-80 space-y-2 overflow-auto rounded border border-line bg-panel/90 p-3">
          <h2 className="text-sm font-semibold text-white">Placements</h2>
          {levelItems.map((item) => (
            <div className="rounded border border-line bg-[#0b1118] p-2 text-xs" key={item.id}>
              <div className="font-medium text-slate-100">{item.name}</div>
              <div className="mt-1 text-muted">
                {item.category} · {item.width}×{item.depth}m · room {item.roomId}
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="min-h-[520px] overflow-hidden rounded border border-line bg-panel/90 p-3">
        <div className="mb-2 text-xs text-muted">Furniture blocks are centered in habitable rooms.</div>
        <div className="h-[calc(100%-1.5rem)] overflow-hidden rounded border border-line bg-[#0b1118]">
          <svg className="h-full w-full" viewBox={getViewBox(version)}>
            <OutlineLayer version={version} />
            {resolvedLevel ? <RoomFillLayer rooms={resolvedLevel.rooms} /> : null}
            <GridLayer version={version} />
            <FurnitureOverlayLayer layout={furnitureLayout} levelId={activeLevel?.id} />
          </svg>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-slate-100">{value}</dd>
    </div>
  );
}
