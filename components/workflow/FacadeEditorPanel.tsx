"use client";

import { RotateCcw } from "lucide-react";
import type { FacadeEnvelope, FacadeZone } from "@/lib/building-domain";

interface FacadeEditorPanelProps {
  facade?: FacadeEnvelope;
  onChange: (patch: Partial<FacadeEnvelope>) => void;
  onResetFromPlan: () => void;
}

const strategyOptions: FacadeZone["strategy"][] = ["curtain_wall", "punched_window", "solid", "mixed"];
const edgeOptions: FacadeZone["edge"][] = ["north", "south", "east", "west"];

export function FacadeEditorPanel({ facade, onChange, onResetFromPlan }: FacadeEditorPanelProps) {
  if (!facade) {
    return (
      <section className="rounded border border-line bg-panel/90 p-6 text-sm text-muted">
        Generate or select a plan to derive facade zones.
      </section>
    );
  }

  function updateZone(zoneId: string, patch: Partial<FacadeZone>) {
    onChange({
      zones: facade.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone))
    });
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Facade envelope</h2>
          <p className="mt-1 text-sm text-muted">Edit window ratios and edge strategies. Manual edits are preserved across sync.</p>
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent"
          type="button"
          onClick={onResetFromPlan}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset from plan
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Default window ratio
          <input
            className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
            max={0.9}
            min={0.05}
            step={0.05}
            type="number"
            value={facade.defaultWindowRatio}
            onChange={(event) => onChange({ defaultWindowRatio: Number(event.target.value) })}
          />
        </label>
        <label className="text-xs text-muted">
          Orientation strategy
          <input
            className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
            value={facade.orientationStrategy ?? ""}
            onChange={(event) => onChange({ orientationStrategy: event.target.value })}
          />
        </label>
      </div>

      <div className="space-y-2">
        {facade.zones.map((zone) => (
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded border border-line bg-[#0b1118] p-3" key={zone.id}>
            <label className="text-xs text-muted">
              Edge
              <select
                className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-1.5 text-sm text-slate-100"
                value={zone.edge}
                onChange={(event) => updateZone(zone.id, { edge: event.target.value as FacadeZone["edge"] })}
              >
                {edgeOptions.map((edge) => (
                  <option key={edge} value={edge}>{edge}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Strategy
              <select
                className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-1.5 text-sm text-slate-100"
                value={zone.strategy}
                onChange={(event) => updateZone(zone.id, { strategy: event.target.value as FacadeZone["strategy"] })}
              >
                {strategyOptions.map((strategy) => (
                  <option key={strategy} value={strategy}>{strategy.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              Target ratio
              <input
                className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-1.5 text-sm text-slate-100"
                max={0.9}
                min={0.05}
                step={0.05}
                type="number"
                value={zone.targetWindowRatio ?? facade.defaultWindowRatio}
                onChange={(event) => updateZone(zone.id, { targetWindowRatio: Number(event.target.value) })}
              />
            </label>
            <div className="self-end text-[10px] uppercase tracking-wide text-muted">{zone.levelId ?? "all levels"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
