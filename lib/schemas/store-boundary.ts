import {
  normalizePlanVersion,
  normalizeProjectVersions,
  type PlanVersionDraft
} from "@/lib/architecture-model";
import { MepLayoutSchema } from "@/lib/schemas/mep-schema";
import { PlanVersionDraftSchema } from "@/lib/schemas/plan-version-schema";
import type { PlanVersion } from "@/lib/project-types";

const LOG_PREFIX = "[evolab:store-validation]";

export function stripVersionForDraftValidation(version: PlanVersion): PlanVersionDraft {
  const { levels, building, mep, standardFloorGroups, verticalElements, ...draft } = version;
  return draft;
}

export function validatePlanVersionInput(version: PlanVersion, context: string): boolean {
  const parsed = PlanVersionDraftSchema.safeParse(stripVersionForDraftValidation(version));

  if (!parsed.success) {
    console.warn(`${LOG_PREFIX} ${context}: invalid plan draft for ${version.id}`, parsed.error.flatten());
    return false;
  }

  if (version.mep) {
    const mepParsed = MepLayoutSchema.safeParse(version.mep);

    if (!mepParsed.success) {
      console.warn(`${LOG_PREFIX} ${context}: invalid MEP for ${version.id}`, mepParsed.error.flatten());
      return false;
    }
  }

  return true;
}

export function validateAndNormalizeProjectVersions(versions: PlanVersion[], context: string): PlanVersion[] {
  for (const version of versions) {
    validatePlanVersionInput(version, context);
  }

  return normalizeProjectVersions(versions);
}

export function validateAndNormalizePlanVersion(version: PlanVersion, context: string): PlanVersion {
  validatePlanVersionInput(version, context);
  return normalizePlanVersion(version);
}
