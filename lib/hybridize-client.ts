import { normalizePlanVersion } from "@/lib/architecture-model";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { CopilotFinding, PlanVersion, Room } from "@/lib/project-types";

export function roomsForHybridPicker(version: PlanVersion, levelId?: string): Room[] {
  const level = levelId ? version.levels.find((item) => item.id === levelId) ?? version.levels[0] : version.levels[0];

  if (!level) {
    return version.rooms;
  }

  return getResolvedLevel(version, level.id).rooms;
}

export function stampHybridVersion(
  result: PlanVersion,
  versionA: PlanVersion,
  versionB: PlanVersion
): PlanVersion {
  const shortLabel = (version: PlanVersion) => version.label.split("·")[0]?.trim() || version.label;

  return normalizePlanVersion({
    ...result,
    id: `version-hybrid-${Date.now()}`,
    label: `Hybrid · ${shortLabel(versionA)} + ${shortLabel(versionB)}`,
    createdAt: new Date().toISOString(),
    parentVersionId: versionA.id,
    metadata: {
      ...result.metadata,
      hybridSourceVersionIds: [versionA.id, versionB.id]
    }
  });
}

export interface HybridizeClientResponse {
  version: PlanVersion;
  findings?: CopilotFinding[];
  lockedRoomIds?: string[];
  geometryValid?: boolean;
  fallback?: boolean;
  warning?: string;
}

export async function requestSchemeHybridize(input: {
  versionA: PlanVersion;
  versionB: PlanVersion;
  keptFromA: string[];
  keptFromB: string[];
  priority?: "A" | "B";
  outline?: PlanVersion["outline"];
}): Promise<HybridizeClientResponse> {
  const response = await fetch("/api/hybridize-schemes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      versionA: input.versionA,
      versionB: input.versionB,
      keptFromA: {
        sourceVersionId: input.versionA.id,
        roomIds: input.keptFromA
      },
      keptFromB: {
        sourceVersionId: input.versionB.id,
        roomIds: input.keptFromB
      },
      priority: input.priority ?? "A",
      outline: input.outline ?? input.versionA.outline
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `hybridize-schemes failed with ${response.status}`);
  }

  return (await response.json()) as HybridizeClientResponse;
}
