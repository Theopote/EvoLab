import { normalizePlanVersion } from "@/lib/architecture-model";
import { getResolvedLevel } from "@/lib/level-rooms";
import { computeBuildableEnvelope } from "@/lib/buildable-envelope";
import { computeEnvironmentSurrogate } from "@/lib/environment-surrogate";
import {
  appendChangeSet,
  createChangeSet,
  getActiveSchedule,
  getCodeContext,
  getRulePack,
  pendingChangeSets,
  syncProjectDomain
} from "@/lib/project-domain";
import {
  mergeGeometryChangeSet,
  shouldMergeGeometryChange,
  startGeometryChangeBurst
} from "@/lib/geometry-change-merge";
import { applyPlanOperations } from "@/lib/plan-change-engine";
import type { PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import { calculateQuantities, checkCompliance } from "@/lib/quantity-engine";
import { rescoreVersions, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";
import { isOutlineStale } from "@/lib/outline-sync";
import type { PlanVersion, ProjectData } from "@/lib/project-types";
import type { EvoProjectStore } from "@/lib/store/types";
import {
  getPendingGeometryChangeBurst,
  setPendingGeometryChangeBurst
} from "@/lib/store/geometry-change-burst";

export function getActiveVersion(project: ProjectData) {
  return project.versions.find((version) => version.id === project.activeVersionId);
}

export function getLevel(version: PlanVersion | undefined, levelId: string | undefined) {
  if (!version) {
    return undefined;
  }

  return version.levels.find((level) => level.id === levelId) ?? version.levels[0];
}

export function clearSelectionDraft(state: EvoProjectStore) {
  state.selectionType = "none";
  state.selectedRoomId = undefined;
  state.selectedWallId = undefined;
  state.selectedOpeningId = undefined;
  state.selectedRoom = undefined;
  state.selectedWall = undefined;
  state.selectedOpening = undefined;
}

export function validateSelectionDraft(state: EvoProjectStore) {
  const version = state.activeVersion;
  const level = state.activeLevel;

  if (!version || state.selectionType === "none") {
    if (!version) {
      clearSelectionDraft(state);
    }
    return;
  }

  if (state.selectionType === "room") {
    const rooms =
      version && level
        ? (getResolvedLevel(version, level.id)?.rooms ?? version.rooms)
        : version?.rooms ?? [];
    if (!state.selectedRoomId || !rooms.some((room) => room.id === state.selectedRoomId)) {
      clearSelectionDraft(state);
    }
    return;
  }

  if (state.selectionType === "wall") {
    if (!state.selectedWallId || !level?.walls.some((wall) => wall.id === state.selectedWallId)) {
      clearSelectionDraft(state);
    }
    return;
  }

  if (!state.selectedOpeningId || !level?.openings.some((opening) => opening.id === state.selectedOpeningId)) {
    clearSelectionDraft(state);
  }
}

export function refreshSiteDerivedDraft(state: EvoProjectStore) {
  state.buildableEnvelope = computeBuildableEnvelope(state.outline, state.zoning);
  state.environmentSurrogate = computeEnvironmentSurrogate({
    outline: state.outline,
    buildings: state.siteContext?.buildings ?? []
  });
}

export function refreshOutlineSyncDraft(state: EvoProjectStore) {
  state.outlineStale = state.activeVersion ? isOutlineStale(state.outline, state.activeVersion.outline) : false;
}

export function refreshCompareLevelDraft(state: EvoProjectStore) {
  const levelIds = state.activeVersion?.levels.map((level) => level.id) ?? [];

  if (!levelIds.length) {
    state.compareLevelId = undefined;
    return;
  }

  if (!state.compareLevelId || !levelIds.includes(state.compareLevelId)) {
    state.compareLevelId = state.activeLevelId && levelIds.includes(state.activeLevelId)
      ? state.activeLevelId
      : levelIds[0];
  }
}

export function syncOutlineFromVersionDraft(state: EvoProjectStore, version: PlanVersion) {
  if (version.outline.length < 3) {
    return;
  }

  state.outline = version.outline;
  state.outlineClosed = true;
  refreshSiteDerivedDraft(state);
  refreshOutlineSyncDraft(state);
}

function buildDomainSyncInput(state: EvoProjectStore) {
  return {
    projectType: state.project.projectType,
    brief: state.brief,
    outline: state.outline,
    zoning: state.zoning,
    siteContext: state.siteContext,
    activeVersion: state.activeVersion
  };
}

export function refreshDomainDraft(state: EvoProjectStore) {
  state.project.domain = syncProjectDomain(state.project.domain, buildDomainSyncInput(state));
  state.activeSchedule = getActiveSchedule(state.project.domain, state.activeVersion?.id);

  const pending = pendingChangeSets(state.project.domain);
  const selectedExists = state.selectedChangeSetId
    ? state.project.domain.changeSets.some((item) => item.id === state.selectedChangeSetId)
    : false;

  if (!selectedExists) {
    state.selectedChangeSetId = pending[0]?.id ?? state.project.domain.changeSets[0]?.id;
  }
}

export function recordGeometryVersionChangeSet(
  state: EvoProjectStore,
  previousVersion: PlanVersion,
  targetVersion: PlanVersion
) {
  const now = Date.now();
  const pendingBurst = getPendingGeometryChangeBurst();

  if (shouldMergeGeometryChange(pendingBurst, targetVersion.id, now) && pendingBurst) {
    const merged = mergeGeometryChangeSet(
      state.project.domain.changeSets,
      pendingBurst,
      targetVersion,
      now
    );
    state.project.domain = {
      ...state.project.domain,
      changeSets: merged.changeSets
    };
    setPendingGeometryChangeBurst(merged.burst);
    return;
  }

  const started = startGeometryChangeBurst(previousVersion, targetVersion, now);
  state.project.domain = appendChangeSet(state.project.domain, started.changeSet);
  setPendingGeometryChangeBurst(started.burst);
}

export function recordVersionChangeSet(
  state: EvoProjectStore,
  source: "ai" | "user" | "import" | "system",
  summary: string,
  baseVersion: PlanVersion,
  targetVersion: PlanVersion
) {
  setPendingGeometryChangeBurst(null);
  state.project.domain = appendChangeSet(
    state.project.domain,
    createChangeSet({
      source,
      summary,
      baseVersion,
      targetVersion
    })
  );
}

export function commitTopologyVersionDraft(state: EvoProjectStore, operation: PlanOperation) {
  if (!state.activeVersion) {
    return;
  }

  const normalized = normalizePlanVersion(state.activeVersion);
  const nextVersion = applyPlanOperations(normalized, [operation], { skipPostProcess: true });
  const committedVersion = normalizePlanVersion(nextVersion);

  state.project.versions = state.project.versions.map((item) =>
    item.id === committedVersion.id ? committedVersion : item
  );
  state.project.activeVersionId = committedVersion.id;
  recordGeometryVersionChangeSet(state, normalized, committedVersion);
  bumpGeometryRevision(state);
  refreshDerivedDraft(state);
}

export function isElementLocked(state: EvoProjectStore, elementId: string) {
  return state.project.domain.lockedElementIds.includes(elementId);
}

export function rescoreProjectVersions(state: EvoProjectStore) {
  const scoringInput = scoringInputFromDomain(state.project.domain, state.project.projectType);
  state.project.versions = rescoreVersions(state.project.versions, scoringInput);
  const activeVersion = getActiveVersion(state.project);
  state.activeVersion = activeVersion;
  if (activeVersion && state.project.activeVersionId === activeVersion.id) {
    state.project.activeVersionId = activeVersion.id;
  }
}

export function refreshDerivedDraft(state: EvoProjectStore) {
  const activeVersion = getActiveVersion(state.project);
  const rawLevel = getLevel(activeVersion, state.activeLevelId);
  const activeLevel =
    activeVersion && rawLevel ? getResolvedLevel(activeVersion, rawLevel.id) : rawLevel;
  const codeContext = getCodeContext(state.project.domain);
  const rulePack = getRulePack(state.project.domain, state.project.projectType);

  state.activeVersion = activeVersion;
  state.activeLevelId = rawLevel?.id;
  state.activeLevel = activeLevel;
  state.quantities = activeVersion ? calculateQuantities(activeVersion, { scope: "building" }) : undefined;
  state.levelQuantities =
    activeVersion && activeLevel
      ? calculateQuantities(activeVersion, { levelId: activeLevel.id, scope: "level" })
      : undefined;
  state.complianceItems = activeVersion ? checkCompliance(activeVersion, codeContext, rulePack) : [];
  state.selectedRoom = activeLevel?.rooms.find((room) => room.id === state.selectedRoomId);
  state.selectedWall = activeLevel?.walls.find((wall) => wall.id === state.selectedWallId);
  state.selectedOpening = activeLevel?.openings.find((opening) => opening.id === state.selectedOpeningId);

  validateSelectionDraft(state);
  refreshOutlineSyncDraft(state);
  refreshCompareLevelDraft(state);
  refreshDomainDraft(state);
}

export function bumpGeometryRevision(state: EvoProjectStore) {
  state.geometryRevision += 1;
}

export const ROOM_GEOMETRY_KEYS = new Set(["polygon", "doors", "windows"]);
export const WALL_GEOMETRY_KEYS = new Set(["start", "end", "thickness", "height"]);
export const OPENING_GEOMETRY_KEYS = new Set([
  "center",
  "width",
  "height",
  "sillHeight",
  "wallId",
  "wallEdgeId",
  "positionOnEdge"
]);

export function patchTouchesGeometry<T extends object>(patch: Partial<T>, geometryKeys: Set<string>) {
  return Object.keys(patch).some((key) => geometryKeys.has(key));
}

export function refreshQuantitiesDraft(state: EvoProjectStore) {
  const rawLevel = getLevel(state.activeVersion, state.activeLevelId);
  const activeLevel =
    state.activeVersion && rawLevel
      ? getResolvedLevel(state.activeVersion, rawLevel.id)
      : rawLevel;
  const codeContext = getCodeContext(state.project.domain);

  state.quantities = state.activeVersion
    ? calculateQuantities(state.activeVersion, { scope: "building" })
    : undefined;
  state.levelQuantities =
    state.activeVersion && activeLevel
      ? calculateQuantities(state.activeVersion, { levelId: activeLevel.id, scope: "level" })
      : undefined;
  state.complianceItems = state.activeVersion
    ? checkCompliance(state.activeVersion, codeContext, getRulePack(state.project.domain, state.project.projectType))
    : [];
  refreshDomainDraft(state);
}

export function commitNormalizedVersionDraft(
  state: EvoProjectStore,
  normalizedVersion: PlanVersion,
  resetSelection = false,
  bumpGeometry = true,
  changeSummary?: string,
  changeSource: "ai" | "user" | "import" | "system" = "user"
) {
  const previousVersion = state.project.versions.find((item) => item.id === normalizedVersion.id);

  state.project.versions = state.project.versions.some((item) => item.id === normalizedVersion.id)
    ? state.project.versions.map((item) => (item.id === normalizedVersion.id ? normalizedVersion : item))
    : [...state.project.versions, normalizedVersion];
  state.project.activeVersionId = normalizedVersion.id;

  if (previousVersion && changeSummary) {
    recordVersionChangeSet(state, changeSource, changeSummary, previousVersion, normalizedVersion);
  }

  if (resetSelection) {
    clearSelectionDraft(state);
    syncOutlineFromVersionDraft(state, normalizedVersion);
  }

  if (bumpGeometry) {
    bumpGeometryRevision(state);
  }

  refreshDerivedDraft(state);
}

export function commitRoomMetadataDraft(state: EvoProjectStore, nextVersion: PlanVersion) {
  state.project.versions = state.project.versions.map((item) =>
    item.id === nextVersion.id ? nextVersion : item
  );
  state.activeVersion = nextVersion;
  state.selectedRoom = nextVersion.rooms.find((room) => room.id === state.selectedRoomId);
  refreshQuantitiesDraft(state);
}
