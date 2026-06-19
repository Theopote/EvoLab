"use client";

import { Sun } from "lucide-react";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { FacadeOverlayLayer } from "@/components/workflow/layers/FacadeOverlayLayer";
import type { FacadeEnvelope } from "@/lib/building-domain";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion } from "@/lib/project-types";

interface FacadeWorkspaceProps {
  version?: PlanVersion;
  activeLevelId?: string;
  facadeEnvelope?: FacadeEnvelope;
  orientationDeg?: number;
  onLevelChange: (levelId: string) => void;
}

const strategyLabel: Record<FacadeEnvelope["zones"][number]["strategy"], string> = {
  curtain_wall: "Curtain wall",
  punched_window: "Punched window",
  solid: "Solid",
  mixed: "Mixed"
};

export function FacadeWorkspace({
  version,
  activeLevelId,
  facadeEnvelope,
  orientationDeg,
  onLevelChange
}: FacadeWorkspaceProps) {
  if (!version) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate or select a plan version to inspect facade zones and window ratios.
      </div>
    );
  }

  const activeLevel = version.levels.find((level) => level.id === activeLevelId) ?? version.levels[0];
  const resolvedLevel = activeLevel ? getResolvedLevel(version, activeLevel.id) : undefined;
  const zones = facadeEnvelope?.zones.filter((zone) => !activeLevel || zone.levelId === activeLevel.id) ?? [];

  return (
    <section className="grid min-h-full grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)] gap-4">
      <div className="space-y-4 overflow-auto">
        <header className="rounded border border-line bg-panel/90 p-3">
          <h1 className="flex items-center gap-2 text-base font-semibold text-white">
            <Sun className="h-4 w-4 text-accent" />
            Facade envelope
          </h1>
          <p className="mt-1 text-xs text-muted">
            Perimeter strategies and target glazing ratios derived from level program and room orientation.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Metric label="Strategy" value={facadeEnvelope?.orientationStrategy ?? "balanced"} />
            <Metric label="Default WWR" value={`${Math.round((facadeEnvelope?.defaultWindowRatio ?? 0) * 100)}%`} />
            <Metric label="Preferred facade" value={`${orientationDeg ?? 180}°`} />
            <Metric label="Zones" value={String(facadeEnvelope?.zones.length ?? 0)} />
          </dl>
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
          <h2 className="mb-3 text-sm font-semibold text-white">Facade zones</h2>
          <div className="space-y-2">
            {zones.map((zone) => (
              <div className="rounded border border-line bg-[#0b1118] p-2 text-xs" key={zone.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium capitalize text-slate-100">{zone.edge}</span>
                  <span className="text-[10px] uppercase tracking-[0.1em] text-muted">{strategyLabel[zone.strategy]}</span>
                </div>
                <div className="mt-1 text-muted">
                  Target WWR {zone.targetWindowRatio ? `${Math.round(zone.targetWindowRatio * 100)}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid min-h-[520px] grid-rows-[auto_minmax(0,1fr)] gap-3 rounded border border-line bg-panel/90 p-3">
        <div className="text-xs text-muted">Perimeter preview — colored edges match facade zone strategy.</div>
        <div className="min-h-0 overflow-hidden rounded border border-line bg-[#0b1118]">
          <svg className="h-full w-full" viewBox={getViewBox(version)}>
            <OutlineLayer version={version} />
            {resolvedLevel ? <RoomFillLayer rooms={resolvedLevel.rooms} /> : null}
            <GridLayer version={version} />
            <FacadeOverlayLayer version={version} facadeEnvelope={facadeEnvelope} levelId={activeLevel?.id} />
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
