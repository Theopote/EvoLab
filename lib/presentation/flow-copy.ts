import { resolveTypologyPack } from "@/lib/typology/resolve";

export function getFlowSlideCopy(projectType?: string) {
  const pack = resolveTypologyPack(projectType);
  const primary =
    pack.analysisLayers.find((layer) => layer.id === "primary_flow")?.label ?? "Primary circulation";
  const staff = pack.analysisLayers.find((layer) => layer.id === "staff_flow")?.label;
  const service = pack.analysisLayers.find((layer) => layer.id === "service_flow")?.label;

  const legendParts = [
    `Blue: ${primary}`,
    staff ? `Purple: ${staff}` : null,
    "Green: egress paths",
    "Pink: sightline cone"
  ].filter(Boolean);

  const flowLabels = [primary, staff, service].filter(Boolean);

  return {
    title: "Circulation & Sightline",
    subtitle: flowLabels.length ? flowLabels.join(" · ") : "Movement and egress analysis",
    bullets: [
      legendParts.join(" · "),
      `Derived from ${pack.label.toLowerCase()} flow definitions, graph pathfinding, and raycasting.`
    ],
    legendLabel: legendParts.join(" · ")
  };
}
