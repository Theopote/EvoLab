"use client";

import type { MepSystemType } from "@/lib/project-types";

export type MepLayerId = MepSystemType | "shafts" | "equipment_rooms";

export interface MepLayer {
  id: MepLayerId;
  label: string;
  category: "system" | "vertical" | "room";
  color: string;
}

export const MEP_LAYERS: MepLayer[] = [
  { id: "hvac", label: "HVAC", category: "system", color: "#5eead4" },
  { id: "plumbing_supply", label: "Water supply", category: "system", color: "#38bdf8" },
  { id: "plumbing_drain", label: "Drainage", category: "system", color: "#60a5fa" },
  { id: "electrical", label: "Power", category: "system", color: "#facc15" },
  { id: "elv", label: "ELV", category: "system", color: "#a78bfa" },
  { id: "fire", label: "Fire", category: "system", color: "#fb7185" },
  { id: "shafts", label: "Shafts", category: "vertical", color: "#f97316" },
  { id: "equipment_rooms", label: "Equipment rooms", category: "room", color: "#e6a23c" }
];

interface MepLayerListProps {
  activeLayers: MepLayerId[];
  isGenerating: boolean;
  canGenerate: boolean;
  onChange: (layers: MepLayerId[]) => void;
  onGenerate: () => void;
}

const categoryLabels: Record<MepLayer["category"], string> = {
  system: "Systems",
  vertical: "Vertical",
  room: "Rooms"
};

export function MepLayerList({
  activeLayers,
  isGenerating,
  canGenerate,
  onChange,
  onGenerate
}: MepLayerListProps) {
  function toggle(layerId: MepLayerId) {
    onChange(
      activeLayers.includes(layerId)
        ? activeLayers.filter((id) => id !== layerId)
        : [...activeLayers, layerId]
    );
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">MEP Layers</h2>
          <p className="mt-1 text-xs text-muted">Concept routes linked to the active floor plan.</p>
        </div>
        <span className="rounded border border-line px-2 py-1 text-xs text-muted">
          {activeLayers.length} on
        </span>
      </div>

      <button
        className="mb-4 h-9 w-full rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canGenerate || isGenerating}
        type="button"
        onClick={onGenerate}
      >
        {isGenerating ? "Generating..." : "Generate MEP"}
      </button>

      <div className="space-y-4">
        {(Object.keys(categoryLabels) as MepLayer["category"][]).map((category) => (
          <div key={category}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">
              {categoryLabels[category]}
            </div>
            <div className="space-y-1.5">
              {MEP_LAYERS.filter((layer) => layer.category === category).map((layer) => (
                <label
                  className="flex h-8 cursor-pointer items-center justify-between rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-200 hover:border-accent/50"
                  key={layer.id}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: layer.color }} />
                    {layer.label}
                  </span>
                  <input
                    checked={activeLayers.includes(layer.id)}
                    className="h-3.5 w-3.5 accent-[#4fb5c8]"
                    type="checkbox"
                    onChange={() => toggle(layer.id)}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
