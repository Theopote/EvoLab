import { resolveLevelOutline } from "@/lib/level-rooms";
import { polygonArea } from "@/lib/plan-validation";
import { clampScore } from "@/lib/rules/metrics/shared";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

function envelopeArea(context: ScoringContext) {
  const footprint = context.version.overallBounds.width * context.version.overallBounds.height;

  if (context.scope === "building" && context.version.levels.length > 1) {
    const groups = context.version.standardFloorGroups;
    const perLevel = context.version.levels.reduce((total, level) => {
      const outline = resolveLevelOutline(level, groups, context.version.outline);
      return total + polygonArea(outline);
    }, 0);

    return perLevel || footprint * context.version.levels.length;
  }

  if (context.scope === "level" || context.scope === "floor_group") {
    return polygonArea(context.version.outline) || footprint;
  }

  return footprint;
}

export const scoreAreaEfficiency = (context: ScoringContext): MetricResult => {
  const grossArea = context.version.rooms.reduce((total, room) => total + room.areaSqm, 0);
  const outlineArea = envelopeArea(context);
  const ratio = grossArea / Math.max(1, outlineArea);
  const score = clampScore(ratio * context.rulePack.scoring.areaEfficiencyFactor);
  const scopeLabel =
    context.scope === "building"
      ? "building envelope"
      : context.scope === "floor_group"
        ? "standard-floor-group outline"
        : "level outline";

  return {
    score,
    summary: `Gross area is ${Math.round(ratio * 100)}% of the ${scopeLabel}.`,
    evidence: [
      { label: "Gross area", value: `${Math.round(grossArea)} sqm` },
      { label: "Envelope area", value: `${Math.round(outlineArea)} sqm` },
      { label: "Fill ratio", value: `${Math.round(ratio * 100)}%`, impact: ratio >= 0.75 ? "positive" : "neutral" }
    ]
  };
};
