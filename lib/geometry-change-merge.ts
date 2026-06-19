import type { ChangeSet } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";
import { createChangeSet, diffPlanVersions } from "@/lib/project-domain";

export const GEOMETRY_CHANGE_MERGE_MS = 3000;
export const GEOMETRY_CHANGE_SUMMARY = "Updated shared room geometry";

export interface GeometryChangeBurst {
  versionId: string;
  baseVersionSnapshot: PlanVersion;
  changeSetId: string;
  lastCommittedAt: number;
}

export function shouldMergeGeometryChange(
  burst: GeometryChangeBurst | null | undefined,
  versionId: string,
  now = Date.now()
) {
  if (!burst) {
    return false;
  }

  return burst.versionId === versionId && now - burst.lastCommittedAt <= GEOMETRY_CHANGE_MERGE_MS;
}

export function mergeGeometryChangeSet(
  changeSets: ChangeSet[],
  burst: GeometryChangeBurst,
  targetVersion: PlanVersion,
  now = Date.now()
): { changeSets: ChangeSet[]; burst: GeometryChangeBurst } {
  const changes = diffPlanVersions(burst.baseVersionSnapshot, targetVersion);

  return {
    changeSets: changeSets.map((changeSet) =>
      changeSet.id === burst.changeSetId
        ? {
            ...changeSet,
            summary: GEOMETRY_CHANGE_SUMMARY,
            changes,
            targetVersionId: targetVersion.id,
            baseVersionSnapshot: burst.baseVersionSnapshot
          }
        : changeSet
    ),
    burst: {
      ...burst,
      lastCommittedAt: now
    }
  };
}

export function startGeometryChangeBurst(
  baseVersion: PlanVersion,
  targetVersion: PlanVersion,
  now = Date.now()
): { changeSet: ChangeSet; burst: GeometryChangeBurst } {
  const changeSet = createChangeSet({
    source: "user",
    summary: GEOMETRY_CHANGE_SUMMARY,
    baseVersion,
    targetVersion
  });

  return {
    changeSet,
    burst: {
      versionId: targetVersion.id,
      baseVersionSnapshot: baseVersion,
      changeSetId: changeSet.id,
      lastCommittedAt: now
    }
  };
}
