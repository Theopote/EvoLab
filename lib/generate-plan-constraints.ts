import {
  computeBuildableEnvelope,
  envelopeContainsPolygon,
  estimateBuildingHeight,
  validateAgainstEnvelope
} from "@/lib/buildable-envelope";
import type { GeneratePlanRequest } from "@/lib/schemas/generate-plan-request-schema";
import type { BuildableEnvelope } from "@/lib/site-types";
import type { PlanVersion, Point } from "@/lib/project-types";
import { polygonAreaSqm } from "@/lib/geometry-kernel";

export interface GeneratePlanConstraints {
  siteOutline?: Point[];
  layoutOutline?: Point[];
  envelope?: BuildableEnvelope;
  floors: number;
}

export function resolveGeneratePlanConstraints(body: GeneratePlanRequest): GeneratePlanConstraints {
  const siteOutline = body.outline;
  const floors = body.floors ?? 1;
  const envelope =
    body.zoning && siteOutline && siteOutline.length >= 3
      ? computeBuildableEnvelope(siteOutline, body.zoning)
      : undefined;
  const layoutOutline = envelope?.valid ? envelope.footprint : siteOutline;

  return {
    siteOutline,
    layoutOutline,
    envelope: envelope?.valid ? envelope : undefined,
    floors
  };
}

export function validatePlanVersionAgainstEnvelope(
  envelope: BuildableEnvelope,
  version: PlanVersion,
  floors: number
) {
  const issues = validateAgainstEnvelope(
    envelope,
    version.outline,
    estimateBuildingHeight(version.rooms, floors)
  );

  version.rooms.forEach((room) => {
    if (!envelopeContainsPolygon(envelope, room.polygon)) {
      issues.push(`Room "${room.name}" extends outside the zoning buildable footprint.`);
    }
  });

  const grossArea = version.rooms.reduce((sum, room) => sum + room.areaSqm, 0);

  if (grossArea > envelope.maxFloorAreaSqm * 1.08) {
    issues.push(
      `Gross area ${Math.round(grossArea)} sqm exceeds zoning floor-area cap ${envelope.maxFloorAreaSqm} sqm.`
    );
  }

  const footprintArea = polygonAreaSqm(envelope.footprint);

  if (footprintArea > 0 && grossArea > footprintArea * 1.02) {
    issues.push(`Room program exceeds the buildable footprint area (${Math.round(footprintArea)} sqm).`);
  }

  return issues;
}

export function envelopeErrorSummary(
  versions: PlanVersion[],
  envelope: BuildableEnvelope | undefined,
  floors: number
) {
  if (!envelope?.valid) {
    return [];
  }

  return versions.flatMap((version) =>
    validatePlanVersionAgainstEnvelope(envelope, version, floors).map((message) => ({
      versionId: version.id,
      issue: "envelope-violation",
      message
    }))
  );
}
