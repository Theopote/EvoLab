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
  onUpdateFacadeEnvelope?: (patch: Partial<Pick<FacadeEnvelope, "defaultWindowRatio" | "orientationStrategy">>) => void;
  onUpdateFacadeZone?: (
    zoneId: string,
    patch: Partial<Pick<FacadeEnvelope["zones"][number], "strategy" | "targetWindowRatio">>
  ) => void;
}

const strategyOptions: FacadeEnvelope["zones"][number]["strategy"][] = [
  "curtain_wall",
  "punched_window",
  "solid",
  "mixed"
];

export function FacadeWorkspace({
  version,
  activeLevelId,
  facadeEnvelope,
  orientationDeg,
  onLevelChange,
  onUpdateFacadeEnvelope,
  onUpdateFacadeZone
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
            Edit glazing targets and perimeter strategies. Changes persist on the domain model across syncs.
          </p>
          <div className="mt-3 grid gap-2">
            <label className="block text-xs text-muted">
              Orientation strategy
              <input
                className="mt-1 h-8 w-full rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100"
                value={facadeEnvelope?.orientationStrategy ?? "balanced"}
                onChange={(event) => onUpdateFacadeEnvelope?.({ orientationStrategy: event.target.value })}
              />
            </label>
            <label className="block text-xs text-muted">
              Default window-to-wall ratio
              <input
                className="mt-1 h-8 w-full rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100"
                max={1}
                min={0}
                step={0.05}
                type="number"
                value={facadeEnvelope?.defaultWindowRatio ?? 0.35}
                onChange={(event) => onUpdateFacadeEnvelope?.({ defaultWindowRatio: Number(event.target.value) })}
              />
            </label>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
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
                <div className="mb-2 font-medium capitalize text-slate-100">{zone.edge}</div>
                <label className="mb-2 block text-muted">
                  Strategy
                  <select
                    className="mt-1 h-8 w-full rounded border border-line bg-[#0a0f15] px-2 text-slate-100"
                    value={zone.strategy}
                    onChange={(event) =>
                      onUpdateFacadeZone?.(zone.id, {
                        strategy: event.target.value as FacadeEnvelope["zones"][number]["strategy"]
                      })
                    }
                  >
                    {strategyOptions.map((strategy) => (
                      <option key={strategy} value={strategy}>
                        {strategy}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-muted">
                  Target WWR
                  <input
                    className="mt-1 h-8 w-full rounded border border-line bg-[#0a0f15] px-2 text-slate-100"
                    max={1}
                    min={0}
                    step={0.05}
                    type="number"
                    value={zone.targetWindowRatio ?? facadeEnvelope?.defaultWindowRatio ?? 0.35}
                    onChange={(event) =>
                      onUpdateFacadeZone?.(zone.id, { targetWindowRatio: Number(event.target.value) })
                    }
                  />
                </label>
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
