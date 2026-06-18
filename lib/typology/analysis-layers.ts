import type { AnalysisLayerId } from "@/lib/project-types";

const SHARED_ENVIRONMENT_LAYERS = [
  { id: "daylight" as const, category: "environment" as const },
  { id: "ventilation" as const, category: "environment" as const },
  { id: "sightline" as const, category: "environment" as const }
];

const SHARED_SAFETY_LAYERS = [
  { id: "egress_path" as const, category: "safety" as const },
  { id: "egress_distance" as const, category: "safety" as const }
];

const SHARED_EFFICIENCY_LAYERS = [{ id: "core_efficiency" as const, category: "efficiency" as const }];

export function buildFlowAnalysisLayers(labels: {
  primary: string;
  staff: string;
  service: string;
}) {
  return [
    { id: "function_zones" as const, label: "Function zones", category: "function" as const },
    { id: "primary_flow" as const, label: labels.primary, category: "function" as const },
    { id: "staff_flow" as const, label: labels.staff, category: "function" as const },
    { id: "service_flow" as const, label: labels.service, category: "function" as const },
    ...SHARED_ENVIRONMENT_LAYERS.map((layer) => ({
      ...layer,
      label:
        layer.id === "daylight"
          ? "Daylight"
          : layer.id === "ventilation"
            ? "Natural ventilation"
            : "Sightline"
    })),
    ...SHARED_SAFETY_LAYERS.map((layer) => ({
      ...layer,
      label: layer.id === "egress_path" ? "Egress path" : "Egress distance"
    })),
    ...SHARED_EFFICIENCY_LAYERS.map((layer) => ({ ...layer, label: "Core efficiency" }))
  ];
}

export const LEGACY_FLOW_LAYER_ALIASES: Record<string, AnalysisLayerId> = {
  patient_flow: "primary_flow",
  clean_dirty_flow: "service_flow"
};

export function canonicalizeAnalysisLayerId(layerId: AnalysisLayerId): AnalysisLayerId {
  return (LEGACY_FLOW_LAYER_ALIASES[layerId] as AnalysisLayerId | undefined) ?? layerId;
}

export function canonicalizeAnalysisLayers(layerIds: AnalysisLayerId[]): AnalysisLayerId[] {
  const seen = new Set<AnalysisLayerId>();
  const result: AnalysisLayerId[] = [];

  layerIds.forEach((layerId) => {
    const canonical = canonicalizeAnalysisLayerId(layerId);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  });

  return result;
}

export function layerRequested(layerIds: AnalysisLayerId[], target: AnalysisLayerId): boolean {
  const canonical = canonicalizeAnalysisLayerId(target);
  return layerIds.some((layerId) => canonicalizeAnalysisLayerId(layerId) === canonical);
}

export function wantsAnyFlowLayer(layerIds: AnalysisLayerId[]): boolean {
  return ["primary_flow", "staff_flow", "service_flow"].some((layerId) =>
    layerRequested(layerIds, layerId as AnalysisLayerId)
  );
}

export const FLOW_LAYER_IDS = ["primary_flow", "staff_flow", "service_flow"] as const;
