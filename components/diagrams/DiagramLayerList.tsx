"use client";

import type { AnalysisLayer, AnalysisLayerId } from "@/lib/project-types";

export const ANALYSIS_LAYERS: AnalysisLayer[] = [
  { id: "function_zones", label: "Function zones", category: "function" },
  { id: "patient_flow", label: "Patient flow", category: "function" },
  { id: "staff_flow", label: "Staff flow", category: "function" },
  { id: "clean_dirty_flow", label: "Clean / dirty flow", category: "function" },
  { id: "daylight", label: "Daylight", category: "environment" },
  { id: "ventilation", label: "Natural ventilation", category: "environment" },
  { id: "sightline", label: "Sightline", category: "environment" },
  { id: "egress_path", label: "Egress path", category: "safety" },
  { id: "egress_distance", label: "Egress distance", category: "safety" },
  { id: "core_efficiency", label: "Core efficiency", category: "efficiency" }
];

const categoryLabels: Record<AnalysisLayer["category"], string> = {
  function: "Function",
  environment: "Environment",
  safety: "Safety",
  efficiency: "Efficiency"
};

interface DiagramLayerListProps {
  activeLayers: AnalysisLayerId[];
  onChange: (layers: AnalysisLayerId[]) => void;
}

export function DiagramLayerList({ activeLayers, onChange }: DiagramLayerListProps) {
  function toggle(layerId: AnalysisLayerId) {
    onChange(
      activeLayers.includes(layerId)
        ? activeLayers.filter((id) => id !== layerId)
        : [...activeLayers, layerId]
    );
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Analysis Layers</h2>
          <p className="mt-1 text-xs text-muted">Stack data overlays from the active PlanVersion.</p>
        </div>
        <span className="rounded border border-line px-2 py-1 text-xs text-muted">
          {activeLayers.length} on
        </span>
      </div>

      <div className="space-y-4">
        {(Object.keys(categoryLabels) as AnalysisLayer["category"][]).map((category) => (
          <div key={category}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">
              {categoryLabels[category]}
            </div>
            <div className="space-y-1.5">
              {ANALYSIS_LAYERS.filter((layer) => layer.category === category).map((layer) => (
                <label
                  className="flex h-8 cursor-pointer items-center justify-between rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-200 hover:border-accent/50"
                  key={layer.id}
                >
                  <span>{layer.label}</span>
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
