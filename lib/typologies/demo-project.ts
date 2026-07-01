import { normalizeProjectVersions } from "@/lib/architecture-model";
import { normalizeProjectData } from "@/lib/project-domain";
import { createMockPlanVersionsFromPack } from "@/lib/typology/layouts";
import { resolveTypologyPack } from "@/lib/typology/resolve";
import type { ProjectData } from "@/lib/project-types";
import { DEFAULT_TYPOLOGY_ID, DEMO_PROJECT_OUTLINE } from "@/lib/typologies/defaults";
import type { TypologyPackId } from "@/lib/typology/types";

export function createDemoProjectData(typologyId: TypologyPackId = DEFAULT_TYPOLOGY_ID, projectId?: string): ProjectData {
  const pack = resolveTypologyPack(typologyId);
  const [primaryScheme] = createMockPlanVersionsFromPack(pack, DEMO_PROJECT_OUTLINE);

  if (!primaryScheme) {
    throw new Error(`Typology pack "${pack.id}" did not produce a demo scheme.`);
  }

  return normalizeProjectData({
    projectId: projectId ?? `evolab-demo-${typologyId}`,
    projectName: `EvoLab ${pack.label} Concept Study`,
    projectType: pack.id,
    activeVersionId: primaryScheme.id,
    versions: normalizeProjectVersions([primaryScheme])
  });
}
