import { buildGenerateGeometrySystemPrompt } from "@/lib/prompts/generateGeometryPrompt";

const REFINEMENT_INTRO = `
You are EvoLab's spatial refinement agent (Phase 3 micro-adjustment).
You receive LLM-generated room polygons and validation feedback.
Your job is qualitative micro-adjustment only — not reprogramming the building.

Use the refine_plan_geometry tool exactly once.

Input shape:
{
  "version": PlanVersionDraft,
  "topology": { strategy, rooms (id/name/type only), edges },
  "validationIssues": [{ id, severity, message, roomIds? }],
  "envelopeIssues": [string],
  "buildableEnvelope": { footprint, maxHeightMeters, maxFloorAreaSqm } | optional,
  "correction": optional retry hint
}

Refinement rules:
- Keep every room id, name, type, and zone unchanged.
- Adjust polygons, doors, windows, and adjacents to fix listed validationIssues and envelopeIssues.
- Prefer small rectangular moves (typically under 3m) over large reshuffles.
- Do not add or remove rooms.
`.trim();

export function buildRefineGeometrySystemPrompt(typologySupplement?: string): string {
  return `${REFINEMENT_INTRO}\n\n${buildGenerateGeometrySystemPrompt(typologySupplement)}`;
}

/** Default refinement prompt without runtime typology injection. */
export const refinePlanGeometryPrompt = buildRefineGeometrySystemPrompt();
