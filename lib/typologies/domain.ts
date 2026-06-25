import type { ProjectDomain } from "@/lib/building-domain";
import { createDefaultScoringConfig } from "@/lib/rules/scoring-config";
import { resolveCodeContextFromTypology } from "@/lib/typologies/code-context";
import { resolveTypologyPack } from "@/lib/typology/resolve";
import type { DesignBrief } from "@/lib/project-types";
import type { TypologyPackId } from "@/lib/typology/types";

export function briefFromTypologyPack(packId: TypologyPackId, overrides?: Partial<DesignBrief>): DesignBrief {
  const pack = resolveTypologyPack(packId);

  return {
    projectType: pack.defaultBrief.projectType ?? pack.id,
    description: pack.defaultBrief.description ?? "",
    floors: overrides?.floors ?? 3,
    targetArea: overrides?.targetArea ?? 2400,
    corePreference: pack.defaultBrief.corePreference ?? "",
    orientationPreference: pack.defaultBrief.orientationPreference ?? "",
    ...overrides
  };
}

export function applyTypologyPackToDomain(domain: ProjectDomain, projectType: string): ProjectDomain {
  const pack = resolveTypologyPack(projectType);

  return {
    ...domain,
    codeContext: resolveCodeContextFromTypology(pack.id),
    scoringConfig: createDefaultScoringConfig(pack.id)
  };
}
