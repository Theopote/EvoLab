"use client";

import { produce } from "immer";
import { type ReactNode } from "react";
import { create } from "zustand";
import { normalizePlanVersion, normalizeProjectVersions } from "@/lib/architecture-model";
import {
  applyLevelRoomsToVersion,
  applyRoomPatchToVersion,
  getResolvedLevel
} from "@/lib/level-rooms";
import type { ScheduleBundle, StoredCopilotProposal, ScoringConfig } from "@/lib/building-domain";
import {
  addCopilotProposalComment as addCopilotProposalCommentInDomain,
  appendCopilotProposal,
  createStoredCopilotProposal,
  dismissCopilotProposal as dismissCopilotProposalInDomain,
  markCopilotProposalApplied,
  resolveProposalOperationSets
} from "@/lib/copilot-proposals";
import { initialProjectData } from "@/lib/evolab-data";
import {
  appendChangeSet,
  approveChangeSetInDomain,
  createChangeSet,
  getActiveSchedule,
  getCodeContext,
  getRulePack,
  pendingChangeSets,
  rejectChangeSetInDomain,
  syncProjectDomain
} from "@/lib/project-domain";
import {
  mergeGeometryChangeSet,
  shouldMergeGeometryChange,
  startGeometryChangeBurst,
  type GeometryChangeBurst
} from "@/lib/geometry-change-merge";
import { calculateQuantities, checkCompliance, type ComplianceItem, type QuantityResult } from "@/lib/quantity-engine";
import { rescoreVersions, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";
import { createDefaultScoringConfig, normalizeScoringConfig } from "@/lib/rules/scoring-config";
import { applyPlanOperations } from "@/lib/plan-change-engine";
import type { PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import { computeBuildableEnvelope } from "@/lib/buildable-envelope";
import type { BuildableEnvelope, EnvironmentSurrogate, SiteContext, ZoningConstraints } from "@/lib/site-types";
import { computeEnvironmentSurrogate } from "@/lib/environment-surrogate";
import { isOutlineStale } from "@/lib/outline-sync";
import { defaultZoningConstraints } from "@/lib/site-types";
import type {
  AnalysisLayerId,
  DesignBrief,
  Level,
  MepLayerId,
  MepLayout,
  OpeningElement,
  PlanVersion,
  Point,
  ProjectData,
  Room,
  Wall,
  WorkspaceTab
} from "@/lib/project-types";
import type { WorkflowPhase } from "@/lib/workflow-phases";
import { phaseForTab, resolvePhaseTab } from "@/lib/workflow-phases";

const defaultOutline: Point[] = [
  [0, 0],
  [72, 0],
  [72, 42],
  [0, 42]
];

const defaultBrief: DesignBrief = {
  projectType: initialProjectData.projectType,
  description:
    "Outpatient clinic with clear public waiting, clinical rooms, staff work area, compact core, shafts aligned with equipment room, and strong south daylight.",
  floors: 3,
  targetArea: 2400,
  corePreference: "north service edge",
  orientationPreference: "south daylight"
};

type SelectionType = "none" | "room" | "wall" | "opening";

interface EvoProjectStore {
  project: ProjectData;
  activeVersion?: PlanVersion;
  activeLevelId?: string;
  activeLevel?: Level;
  geometryRevision: number;
  selectedRoomId?: string;
  selectedWallId?: string;
  selectedOpeningId?: string;
  selectionType: SelectionType;
  selectedRoom?: Room;
  selectedWall?: Wall;
  selectedOpening?: OpeningElement;
  outline: Point[];
  outlineClosed: boolean;
  siteContext?: SiteContext;
  siteAddressQuery: string;
  isFetchingSite: boolean;
  siteError: string | null;
  zoning: ZoningConstraints;
  buildableEnvelope?: BuildableEnvelope;
  environmentSurrogate?: EnvironmentSurrogate;
  showSiteContextLayer: boolean;
  showEnvironmentOverlay: boolean;
  brief: DesignBrief;
  workflowPhase: WorkflowPhase;
  compareVersionIds: string[];
  activeTab: WorkspaceTab;
  activeAnalysisLayers: AnalysisLayerId[];
  activeMepLayers: MepLayerId[];
  isGeneratingMep: boolean;
  mepError: string | null;
  quantities?: QuantityResult;
  levelQuantities?: QuantityResult;
  activeSchedule?: ScheduleBundle;
  complianceItems: ComplianceItem[];
  outlineStale: boolean;
  isRelayouting: boolean;
  relayoutError: string | null;
  compareLevelId?: string;
  selectedChangeSetId?: string;
  setActiveTab: (tab: WorkspaceTab) => void;
  setOutline: (outline: Point[]) => void;
  setOutlineClosed: (closed: boolean) => void;
  setZoning: (zoning: ZoningConstraints) => void;
  setSiteAddressQuery: (query: string) => void;
  fetchSiteContext: (address?: string) => Promise<void>;
  applySuggestedSiteOutline: () => void;
  setShowSiteContextLayer: (visible: boolean) => void;
  setShowEnvironmentOverlay: (visible: boolean) => void;
  refreshEnvironmentSurrogate: () => void;
  updateBrief: (brief: DesignBrief) => void;
  updateScoringConfig: (patch: Partial<ScoringConfig>) => void;
  resetScoringConfig: () => void;
  setWorkflowPhase: (phase: WorkflowPhase) => void;
  toggleCompareVersion: (versionId: string) => void;
  setActiveAnalysisLayers: (layers: AnalysisLayerId[]) => void;
  setActiveMepLayers: (layers: MepLayerId[]) => void;
  setActiveLevel: (levelId: string) => void;
  selectRoom: (roomId: string) => void;
  selectWall: (wallId: string) => void;
  selectOpening: (openingId: string) => void;
  clearSelection: () => void;
  updateRoom: (roomId: string, patch: Partial<Room>) => void;
  updateRoomGeometry: (roomId: string, patch: Partial<Room>) => void;
  applyLevelRoomsGeometry: (rooms: Room[]) => void;
  splitActiveRoom: (input: {
    axis: "horizontal" | "vertical";
    splitRatio: number;
    secondRoomName: string;
  }) => void;
  mergeActiveRoomWith: (neighborRoomId: string, mergedName?: string) => void;
  addParametricOpening: (input: {
    roomId: string;
    kind: "door" | "window";
    wall: Room["doors"][number]["wall"];
    position?: number;
    width?: number;
  }) => void;
  updateWall: (wallId: string, patch: Partial<Wall>) => void;
  updateOpening: (openingId: string, patch: Partial<OpeningElement>) => void;
  replaceVersions: (versions: PlanVersion[], projectType?: string) => void;
  appendGeneratedVersions: (versions: PlanVersion[], projectType?: string) => void;
  setActiveVersion: (version: PlanVersion) => void;
  updateActiveVersion: (
    version: PlanVersion,
    options?: { summary?: string; source?: "ai" | "user" | "import" | "system" }
  ) => void;
  relayoutActiveVersion: () => Promise<void>;
  setCompareLevel: (levelId: string) => void;
  selectChangeSet: (changeSetId?: string) => void;
  approveChangeSet: (changeSetId: string, lockChangedElements?: boolean) => void;
  rejectChangeSet: (changeSetId: string) => void;
  toggleElementLock: (elementId: string) => void;
  registerCopilotProposal: (input: {
    prompt: string;
    baseVersion: PlanVersion;
    proposal: StoredCopilotProposal["proposal"];
    findings: StoredCopilotProposal["findings"];
    warning?: string;
  }) => StoredCopilotProposal;
  applyCopilotProposal: (
    proposalId: string,
    version: PlanVersion,
    acceptedOperationIds: string[]
  ) => { prompt: string; parentVersion: PlanVersion; resultVersion: PlanVersion } | undefined;
  dismissCopilotProposal: (proposalId: string) => void;
  addCopilotProposalComment: (proposalId: string, text: string) => void;
  generateMep: () => Promise<void>;
  openModelForVersion: (version: PlanVersion) => void;
  refineVersion: (version: PlanVersion) => void;
  returnToPlanGeneration: () => void;
}

function getActiveVersion(project: ProjectData) {
  return project.versions.find((version) => version.id === project.activeVersionId);
}

function getLevel(version: PlanVersion | undefined, levelId: string | undefined) {
  if (!version) {
    return undefined;
  }

  return version.levels.find((level) => level.id === levelId) ?? version.levels[0];
}

function clearSelectionDraft(state: EvoProjectStore) {
  state.selectionType = "none";
  state.selectedRoomId = undefined;
  state.selectedWallId = undefined;
  state.selectedOpeningId = undefined;
  state.selectedRoom = undefined;
  state.selectedWall = undefined;
  state.selectedOpening = undefined;
}

function validateSelectionDraft(state: EvoProjectStore) {
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

function refreshSiteDerivedDraft(state: EvoProjectStore) {
  state.buildableEnvelope = computeBuildableEnvelope(state.outline, state.zoning);
  state.environmentSurrogate = computeEnvironmentSurrogate({
    outline: state.outline,
    buildings: state.siteContext?.buildings ?? []
  });
}

function refreshOutlineSyncDraft(state: EvoProjectStore) {
  state.outlineStale = state.activeVersion ? isOutlineStale(state.outline, state.activeVersion.outline) : false;
}

function refreshCompareLevelDraft(state: EvoProjectStore) {
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

function syncOutlineFromVersionDraft(state: EvoProjectStore, version: PlanVersion) {
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

function refreshDomainDraft(state: EvoProjectStore) {
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

let pendingGeometryChangeBurst: GeometryChangeBurst | null = null;

export function resetGeometryChangeBurstForTests() {
  pendingGeometryChangeBurst = null;
}

function recordGeometryVersionChangeSet(
  state: EvoProjectStore,
  previousVersion: PlanVersion,
  targetVersion: PlanVersion
) {
  const now = Date.now();

  if (shouldMergeGeometryChange(pendingGeometryChangeBurst, targetVersion.id, now) && pendingGeometryChangeBurst) {
    const merged = mergeGeometryChangeSet(
      state.project.domain.changeSets,
      pendingGeometryChangeBurst,
      targetVersion,
      now
    );
    state.project.domain = {
      ...state.project.domain,
      changeSets: merged.changeSets
    };
    pendingGeometryChangeBurst = merged.burst;
    return;
  }

  const started = startGeometryChangeBurst(previousVersion, targetVersion, now);
  state.project.domain = appendChangeSet(state.project.domain, started.changeSet);
  pendingGeometryChangeBurst = started.burst;
}

function recordVersionChangeSet(
  state: EvoProjectStore,
  source: "ai" | "user" | "import" | "system",
  summary: string,
  baseVersion: PlanVersion,
  targetVersion: PlanVersion
) {
  pendingGeometryChangeBurst = null;
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

function commitTopologyVersionDraft(state: EvoProjectStore, operation: PlanOperation) {
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

function isElementLocked(state: EvoProjectStore, elementId: string) {
  return state.project.domain.lockedElementIds.includes(elementId);
}

function rescoreProjectVersions(state: EvoProjectStore) {
  const scoringInput = scoringInputFromDomain(state.project.domain, state.project.projectType);
  state.project.versions = rescoreVersions(state.project.versions, scoringInput);
  const activeVersion = getActiveVersion(state.project);
  state.activeVersion = activeVersion;
  if (activeVersion && state.project.activeVersionId === activeVersion.id) {
    state.project.activeVersionId = activeVersion.id;
  }
}

function refreshDerivedDraft(state: EvoProjectStore) {
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

function bumpGeometryRevision(state: EvoProjectStore) {
  state.geometryRevision += 1;
}

const ROOM_GEOMETRY_KEYS = new Set(["polygon", "doors", "windows"]);
const WALL_GEOMETRY_KEYS = new Set(["start", "end", "thickness", "height"]);
const OPENING_GEOMETRY_KEYS = new Set(["center", "width", "height", "sillHeight", "wallId", "wallEdgeId", "positionOnEdge"]);

function patchTouchesGeometry<T extends object>(patch: Partial<T>, geometryKeys: Set<string>) {
  return Object.keys(patch).some((key) => geometryKeys.has(key));
}

function refreshQuantitiesDraft(state: EvoProjectStore) {
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
  state.complianceItems = state.activeVersion ? checkCompliance(state.activeVersion, codeContext, getRulePack(state.project.domain, state.project.projectType)) : [];
  refreshDomainDraft(state);
}

function commitNormalizedVersionDraft(
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

function commitRoomMetadataDraft(state: EvoProjectStore, nextVersion: PlanVersion) {
  state.project.versions = state.project.versions.map((item) =>
    item.id === nextVersion.id ? nextVersion : item
  );
  state.activeVersion = nextVersion;
  state.selectedRoom = nextVersion.rooms.find((room) => room.id === state.selectedRoomId);
  refreshQuantitiesDraft(state);
}

function createInitialState(): Omit<
  EvoProjectStore,
  | "setActiveTab"
  | "setOutline"
  | "setOutlineClosed"
  | "setZoning"
  | "setSiteAddressQuery"
  | "fetchSiteContext"
  | "applySuggestedSiteOutline"
  | "setShowSiteContextLayer"
  | "setShowEnvironmentOverlay"
  | "refreshEnvironmentSurrogate"
  | "updateBrief"
  | "updateScoringConfig"
  | "resetScoringConfig"
  | "setWorkflowPhase"
  | "toggleCompareVersion"
  | "setActiveAnalysisLayers"
  | "setActiveMepLayers"
  | "setActiveLevel"
  | "selectRoom"
  | "selectWall"
  | "selectOpening"
  | "clearSelection"
  | "updateRoom"
  | "updateRoomGeometry"
  | "applyLevelRoomsGeometry"
  | "splitActiveRoom"
  | "mergeActiveRoomWith"
  | "addParametricOpening"
  | "updateWall"
  | "updateOpening"
  | "replaceVersions"
  | "appendGeneratedVersions"
  | "setActiveVersion"
  | "updateActiveVersion"
  | "relayoutActiveVersion"
  | "setCompareLevel"
  | "selectChangeSet"
  | "approveChangeSet"
  | "rejectChangeSet"
  | "toggleElementLock"
  | "registerCopilotProposal"
  | "applyCopilotProposal"
  | "dismissCopilotProposal"
  | "addCopilotProposalComment"
  | "generateMep"
  | "openModelForVersion"
  | "refineVersion"
  | "returnToPlanGeneration"
> {
  const activeVersion = getActiveVersion(initialProjectData);
  const rawLevel = getLevel(activeVersion, undefined);
  const activeLevel =
    activeVersion && rawLevel ? getResolvedLevel(activeVersion, rawLevel.id) : rawLevel;

  return {
    project: initialProjectData,
    activeVersion,
    activeLevelId: activeLevel?.id,
    activeLevel,
    geometryRevision: 0,
    selectedRoomId: undefined,
    selectedWallId: undefined,
    selectedOpeningId: undefined,
    selectionType: "none",
    selectedRoom: undefined,
    selectedWall: undefined,
    selectedOpening: undefined,
    outline: defaultOutline,
    outlineClosed: true,
    siteContext: undefined,
    siteAddressQuery: "",
    isFetchingSite: false,
    siteError: null,
    zoning: defaultZoningConstraints,
    buildableEnvelope: computeBuildableEnvelope(defaultOutline, defaultZoningConstraints),
    environmentSurrogate: computeEnvironmentSurrogate({ outline: defaultOutline, buildings: [] }),
    showSiteContextLayer: true,
    showEnvironmentOverlay: true,
    brief: defaultBrief,
    workflowPhase: "brief_site",
    compareVersionIds: [],
    activeTab: "Plan",
    activeAnalysisLayers: ["function_zones", "primary_flow", "egress_path", "daylight"],
    activeMepLayers: ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "shafts", "equipment_rooms"],
    isGeneratingMep: false,
    mepError: null,
    quantities: activeVersion ? calculateQuantities(activeVersion, { scope: "building" }) : undefined,
    levelQuantities:
      activeVersion && activeLevel
        ? calculateQuantities(activeVersion, { levelId: activeLevel.id, scope: "level" })
        : undefined,
    complianceItems: activeVersion
      ? checkCompliance(
          activeVersion,
          getCodeContext(initialProjectData.domain),
          getRulePack(initialProjectData.domain, initialProjectData.projectType)
        )
      : [],
    activeSchedule: getActiveSchedule(initialProjectData.domain, activeVersion?.id),
    outlineStale: false,
    isRelayouting: false,
    relayoutError: null,
    compareLevelId: activeLevel?.id,
    selectedChangeSetId: initialProjectData.domain.changeSets[0]?.id
  };
}

export const useEvoProjectStore = create<EvoProjectStore>((set, get) => ({
  ...createInitialState(),
  setActiveTab: (tab) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeTab = tab;

        if (tab === "Plan") {
          if (state.workflowPhase !== "brief_site" && state.workflowPhase !== "scheme") {
            state.workflowPhase = "brief_site";
          }
          return;
        }

        state.workflowPhase = phaseForTab(tab);
      })
    ),
  setOutline: (outline) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.outline = outline;
        refreshSiteDerivedDraft(state);
        refreshOutlineSyncDraft(state);
        refreshDomainDraft(state);
      })
    ),
  setOutlineClosed: (closed) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.outlineClosed = closed;
      })
    ),
  setZoning: (zoning) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.zoning = zoning;
        refreshSiteDerivedDraft(state);
        refreshDomainDraft(state);
      })
    ),
  setSiteAddressQuery: (query) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.siteAddressQuery = query;
      })
    ),
  fetchSiteContext: async (address) => {
    const query = (address ?? get().siteAddressQuery).trim();

    if (!query) {
      set(
        produce<EvoProjectStore>((state) => {
          state.siteError = "Enter a project address first.";
        })
      );
      return;
    }

    set(
      produce<EvoProjectStore>((state) => {
        state.isFetchingSite = true;
        state.siteError = null;
        state.siteAddressQuery = query;
      })
    );

    try {
      const response = await fetch("/api/fetch-site-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: query })
      });

      if (!response.ok) {
        throw new Error(`fetch-site-context failed with ${response.status}`);
      }

      const data = (await response.json()) as { context?: SiteContext; warning?: string };

      if (!data.context) {
        throw new Error("Site context response was empty.");
      }

      set(
        produce<EvoProjectStore>((state) => {
          state.siteContext = data.context;
          refreshDomainDraft(state);
          state.siteError = data.warning ?? null;
          refreshSiteDerivedDraft(state);
        })
      );
    } catch (error) {
      set(
        produce<EvoProjectStore>((state) => {
          state.siteError = error instanceof Error ? error.message : "Failed to fetch site context.";
        })
      );
    } finally {
      set(
        produce<EvoProjectStore>((state) => {
          state.isFetchingSite = false;
        })
      );
    }
  },
  applySuggestedSiteOutline: () =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.siteContext?.suggestedOutline.length) {
          return;
        }

        state.outline = state.siteContext.suggestedOutline;
        state.outlineClosed = true;
        refreshSiteDerivedDraft(state);
      })
    ),
  setShowSiteContextLayer: (visible) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.showSiteContextLayer = visible;
      })
    ),
  setShowEnvironmentOverlay: (visible) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.showEnvironmentOverlay = visible;
      })
    ),
  refreshEnvironmentSurrogate: () =>
    set(
      produce<EvoProjectStore>((state) => {
        refreshSiteDerivedDraft(state);
      })
    ),
  updateBrief: (brief) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.brief = brief;
        refreshDomainDraft(state);
      })
    ),
  updateScoringConfig: (patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain.scoringConfig = normalizeScoringConfig(
          {
            ...state.project.domain.scoringConfig,
            ...patch,
            scoringThresholds: patch.scoringThresholds
              ? { ...state.project.domain.scoringConfig?.scoringThresholds, ...patch.scoringThresholds }
              : state.project.domain.scoringConfig?.scoringThresholds,
            goalWeights: patch.goalWeights
              ? { ...state.project.domain.scoringConfig?.goalWeights, ...patch.goalWeights }
              : state.project.domain.scoringConfig?.goalWeights,
            ruleThresholds: patch.ruleThresholds
              ? { ...state.project.domain.scoringConfig?.ruleThresholds, ...patch.ruleThresholds }
              : state.project.domain.scoringConfig?.ruleThresholds
          },
          state.project.projectType
        );
        rescoreProjectVersions(state);
        refreshDerivedDraft(state);
      })
    ),
  resetScoringConfig: () =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain.scoringConfig = createDefaultScoringConfig(state.project.projectType);
        rescoreProjectVersions(state);
        refreshDerivedDraft(state);
      })
    ),
  setWorkflowPhase: (phase) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.workflowPhase = phase;
        state.activeTab = resolvePhaseTab(phase, state.activeTab);
      })
    ),
  toggleCompareVersion: (versionId) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (state.compareVersionIds.includes(versionId)) {
          state.compareVersionIds = state.compareVersionIds.filter((id) => id !== versionId);
          return;
        }

        state.compareVersionIds = [...state.compareVersionIds, versionId].slice(-2);
      })
    ),
  setActiveAnalysisLayers: (layers) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeAnalysisLayers = layers;
      })
    ),
  setActiveMepLayers: (layers) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeMepLayers = layers;
      })
    ),
  setActiveLevel: (levelId) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion?.levels.some((level) => level.id === levelId)) {
          return;
        }

        state.activeLevelId = levelId;
        state.compareLevelId = levelId;
        refreshDerivedDraft(state);
      })
    ),
  setCompareLevel: (levelId) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion?.levels.some((level) => level.id === levelId)) {
          return;
        }

        state.compareLevelId = levelId;
      })
    ),
  toggleElementLock: (elementId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const locked = state.project.domain.lockedElementIds;
        state.project.domain.lockedElementIds = locked.includes(elementId)
          ? locked.filter((id) => id !== elementId)
          : [...locked, elementId];
      })
    ),
  registerCopilotProposal: (input) => {
    const stored = createStoredCopilotProposal(input);

    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = appendCopilotProposal(state.project.domain, stored);
      })
    );

    return stored;
  },
  applyCopilotProposal: (proposalId, version, acceptedOperationIds) => {
    const state = get();
    const stored = state.project.domain.copilotProposals.find((item) => item.id === proposalId);

    if (!stored || stored.status !== "draft") {
      return undefined;
    }

    const parentVersion =
      stored.baseVersionSnapshot ??
      state.project.versions.find((item) => item.id === stored.baseVersionId);

    if (!parentVersion) {
      return undefined;
    }

    const normalized = normalizePlanVersion(version);
    const operationSets = resolveProposalOperationSets(
      stored.proposal,
      acceptedOperationIds,
      state.project.domain.lockedElementIds,
      parentVersion
    );
    const changeSet = createChangeSet({
      source: "ai",
      summary: stored.proposal.intent,
      baseVersion: parentVersion,
      targetVersion: normalized,
      proposalId,
      acceptedOperationIds: operationSets.acceptedOperationIds
    });

    set(
      produce<EvoProjectStore>((draft) => {
        draft.project.versions = [...draft.project.versions, normalized];
        draft.project.activeVersionId = normalized.id;
        draft.project.domain = appendChangeSet(draft.project.domain, changeSet);
        draft.project.domain = markCopilotProposalApplied(draft.project.domain, proposalId, {
          resultVersionId: normalized.id,
          changeSetId: changeSet.id,
          ...operationSets
        });
        bumpGeometryRevision(draft);
        refreshDerivedDraft(draft);
      })
    );

    return {
      prompt: stored.prompt,
      parentVersion,
      resultVersion: normalized
    };
  },
  dismissCopilotProposal: (proposalId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = dismissCopilotProposalInDomain(state.project.domain, proposalId);
      })
    ),
  addCopilotProposalComment: (proposalId, text) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = addCopilotProposalCommentInDomain(state.project.domain, proposalId, text);
      })
    ),
  selectChangeSet: (changeSetId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectedChangeSetId = changeSetId;
      })
    ),
  approveChangeSet: (changeSetId, lockChangedElements = true) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = approveChangeSetInDomain(state.project.domain, changeSetId, {
          lockChangedElements
        });
      })
    ),
  rejectChangeSet: (changeSetId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const result = rejectChangeSetInDomain(state.project.domain, changeSetId, state.project.versions);
        state.project.domain = result.domain;
        state.project.versions = result.versions;
        state.project.activeVersionId = result.activeVersionId;
        clearSelectionDraft(state);
        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  selectRoom: (roomId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectionType = "room";
        state.selectedRoomId = roomId;
        state.selectedWallId = undefined;
        state.selectedOpeningId = undefined;
        refreshDerivedDraft(state);
      })
    ),
  selectWall: (wallId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectionType = "wall";
        state.selectedWallId = wallId;
        state.selectedRoomId = undefined;
        state.selectedOpeningId = undefined;
        refreshDerivedDraft(state);
      })
    ),
  selectOpening: (openingId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectionType = "opening";
        state.selectedOpeningId = openingId;
        state.selectedRoomId = undefined;
        state.selectedWallId = undefined;
        refreshDerivedDraft(state);
      })
    ),
  clearSelection: () =>
    set(
      produce<EvoProjectStore>((state) => {
        clearSelectionDraft(state);
      })
    ),
  updateRoom: (roomId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, roomId)) {
          return;
        }

        if (patchTouchesGeometry(patch, ROOM_GEOMETRY_KEYS)) {
          const normalized = normalizePlanVersion(state.activeVersion);
          const nextVersion = applyRoomPatchToVersion(normalized, state.activeLevelId, roomId, patch);

          if (!nextVersion) {
            return;
          }

          commitNormalizedVersionDraft(
            state,
            normalizePlanVersion(nextVersion),
            false,
            true,
            `Updated room geometry for ${roomId}`,
            "user"
          );
          return;
        }

        const nextVersion = applyRoomPatchToVersion(state.activeVersion, state.activeLevelId, roomId, patch);

        if (!nextVersion) {
          return;
        }

        commitRoomMetadataDraft(state, nextVersion);
      })
    ),
  updateRoomGeometry: (roomId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, roomId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const nextVersion = applyRoomPatchToVersion(normalized, state.activeLevelId, roomId, patch);

        if (!nextVersion) {
          return;
        }

        commitNormalizedVersionDraft(
          state,
          normalizePlanVersion(nextVersion),
          false,
          true,
          `Updated room geometry for ${roomId}`,
          "user"
        );
      })
    ),
  applyLevelRoomsGeometry: (rooms) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (rooms.some((room) => isElementLocked(state, room.id))) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const nextVersion = applyLevelRoomsToVersion(normalized, state.activeLevelId, rooms);

        if (!nextVersion) {
          return;
        }

        const previousVersion = normalized;
        const committedVersion = normalizePlanVersion(nextVersion);

        state.project.versions = state.project.versions.map((item) =>
          item.id === committedVersion.id ? committedVersion : item
        );
        state.project.activeVersionId = committedVersion.id;

        if (previousVersion) {
          recordGeometryVersionChangeSet(state, previousVersion, committedVersion);
        }

        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  splitActiveRoom: (input) =>
    set(
      produce<EvoProjectStore>((state) => {
        const roomId = state.selectedRoomId;

        if (!roomId || isElementLocked(state, roomId)) {
          return;
        }

        commitTopologyVersionDraft(state, {
          id: `op-split-${Date.now()}`,
          type: "split_room",
          label: `Split ${roomId}`,
          targetRoomIds: [roomId],
          roomId,
          splitAxis: input.axis,
          splitRatio: input.splitRatio,
          secondRoomName: input.secondRoomName
        });
      })
    ),
  mergeActiveRoomWith: (neighborRoomId, mergedName) =>
    set(
      produce<EvoProjectStore>((state) => {
        const roomId = state.selectedRoomId;

        if (!roomId || isElementLocked(state, roomId) || isElementLocked(state, neighborRoomId)) {
          return;
        }

        const room = state.activeVersion?.rooms.find((item) => item.id === roomId);
        const neighbor = state.activeVersion?.rooms.find((item) => item.id === neighborRoomId);

        if (!room || !neighbor) {
          return;
        }

        commitTopologyVersionDraft(state, {
          id: `op-merge-${Date.now()}`,
          type: "merge_room",
          label: `Merge ${room.name} + ${neighbor.name}`,
          targetRoomIds: [roomId, neighborRoomId],
          primaryRoomId: roomId,
          secondaryRoomId: neighborRoomId,
          mergedRoomName: mergedName ?? `${room.name} + ${neighbor.name}`
        });
        state.selectedRoomId = roomId;
      })
    ),
  addParametricOpening: (input) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, input.roomId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const operation: PlanOperation = {
          id: `op-${input.kind}-${Date.now()}`,
          type: "add_opening",
          label: `Add ${input.kind}`,
          targetRoomIds: [input.roomId],
          roomId: input.roomId,
          openingKind: input.kind,
          wall: input.wall,
          position: input.position ?? 0.5,
          width: input.width ?? (input.kind === "door" ? 1 : 1.2)
        };
        const nextVersion = applyPlanOperations(normalized, [operation], { skipPostProcess: true });

        commitNormalizedVersionDraft(
          state,
          normalizePlanVersion(nextVersion),
          false,
          true,
          `Added ${input.kind} to ${input.roomId}`,
          "user"
        );
      })
    ),
  updateWall: (wallId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = getLevel(normalized, state.activeLevelId);

        if (!level?.walls.some((wall) => wall.id === wallId)) {
          return;
        }

        const nextLevels = normalized.levels.map((item) =>
          item.id === level.id
            ? {
                ...item,
                walls: item.walls.map((wall) => (wall.id === wallId ? { ...wall, ...patch, id: wall.id } : wall))
              }
            : item
        );
        const nextVersion = {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        };

        if (patchTouchesGeometry(patch, WALL_GEOMETRY_KEYS)) {
          commitNormalizedVersionDraft(state, normalizePlanVersion(nextVersion));
          return;
        }

        commitNormalizedVersionDraft(state, nextVersion, false, false);
        state.selectedWall = nextLevels
          .flatMap((item) => item.walls)
          .find((wall) => wall.id === state.selectedWallId);
      })
    ),
  updateOpening: (openingId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, openingId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = getLevel(normalized, state.activeLevelId);

        if (!level?.openings.some((opening) => opening.id === openingId)) {
          return;
        }

        const nextLevels = normalized.levels.map((item) =>
          item.id === level.id
            ? {
                ...item,
                openings: item.openings.map((opening) =>
                  opening.id === openingId ? { ...opening, ...patch, id: opening.id } : opening
                )
              }
            : item
        );
        const nextVersion = {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        };

        if (patchTouchesGeometry(patch, OPENING_GEOMETRY_KEYS)) {
          commitNormalizedVersionDraft(state, normalizePlanVersion(nextVersion));
          return;
        }

        commitNormalizedVersionDraft(state, nextVersion, false, false);
        state.selectedOpening = nextLevels
          .flatMap((item) => item.openings)
          .find((opening) => opening.id === state.selectedOpeningId);
      })
    ),
  replaceVersions: (versions, projectType = get().brief.projectType) =>
    set(
      produce<EvoProjectStore>((state) => {
        const normalizedVersions = normalizeProjectVersions(versions);

        state.project.projectType = projectType;
        state.project.versions = normalizedVersions;
        state.project.activeVersionId = normalizedVersions[0]?.id ?? state.project.activeVersionId;
        clearSelectionDraft(state);
        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  appendGeneratedVersions: (versions, projectType = get().brief.projectType) =>
    set(
      produce<EvoProjectStore>((state) => {
        const parentVersionId = state.project.activeVersionId || state.project.versions[0]?.id;
        const normalizedVersions = normalizeProjectVersions(versions).map((version) => ({
          ...version,
          parentVersionId: version.parentVersionId ?? parentVersionId
        }));

        const parentVersion = state.project.versions.find((version) => version.id === parentVersionId);

        state.project.projectType = projectType;
        state.project.versions = [...state.project.versions, ...normalizedVersions];
        state.project.activeVersionId = normalizedVersions[0]?.id ?? state.project.activeVersionId;
        clearSelectionDraft(state);
        bumpGeometryRevision(state);

        if (parentVersion && normalizedVersions[0]) {
          recordVersionChangeSet(
            state,
            "ai",
            `Generated ${normalizedVersions.length} new scheme(s)`,
            parentVersion,
            normalizedVersions[0]
          );
        }

        refreshDerivedDraft(state);

        const nextActiveVersion = getActiveVersion(state.project);
        if (nextActiveVersion) {
          syncOutlineFromVersionDraft(state, nextActiveVersion);
        }
      })
    ),
  setActiveVersion: (version) =>
    set(
      produce<EvoProjectStore>((state) => {
        commitNormalizedVersionDraft(state, normalizePlanVersion(version), true);
      })
    ),
  updateActiveVersion: (version, options) =>
    set(
      produce<EvoProjectStore>((state) => {
        commitNormalizedVersionDraft(
          state,
          normalizePlanVersion(version),
          false,
          true,
          options?.summary,
          options?.source ?? "user"
        );
      })
    ),
  relayoutActiveVersion: async () => {
    const { activeVersion, outline, buildableEnvelope } = get();

    if (!activeVersion || get().isRelayouting) {
      return;
    }

    set(
      produce<EvoProjectStore>((state) => {
        state.isRelayouting = true;
        state.relayoutError = null;
      })
    );

    try {
      const response = await fetch("/api/relayout-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: activeVersion,
          outline,
          layoutOutline: buildableEnvelope?.valid ? buildableEnvelope.footprint : outline
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `relayout-plan failed with ${response.status}`);
      }

      const data = (await response.json()) as { version?: PlanVersion };

      if (!data.version) {
        throw new Error("relayout-plan did not return a version.");
      }

      set(
        produce<EvoProjectStore>((state) => {
          commitNormalizedVersionDraft(
            state,
            normalizePlanVersion(data.version!),
            true,
            true,
            "Relayout active version from topology graph",
            "ai"
          );
          state.relayoutError = null;
        })
      );
    } catch (error) {
      set(
        produce<EvoProjectStore>((state) => {
          state.relayoutError = error instanceof Error ? error.message : "Failed to relayout active version.";
        })
      );
    } finally {
      set(
        produce<EvoProjectStore>((state) => {
          state.isRelayouting = false;
        })
      );
    }
  },
  generateMep: async () => {
    const activeVersion = get().activeVersion;

    if (!activeVersion || get().isGeneratingMep) {
      return;
    }

    set(
      produce<EvoProjectStore>((state) => {
        state.isGeneratingMep = true;
        state.mepError = null;
      })
    );

    try {
      const response = await fetch("/api/generate-mep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: activeVersion })
      });

      if (!response.ok) {
        throw new Error(`generate-mep failed with ${response.status}`);
      }

      const data = (await response.json()) as { mep?: MepLayout; warning?: string };

      if (!data.mep?.routes) {
        throw new Error("generate-mep did not return a MepLayout.");
      }

      set(
        produce<EvoProjectStore>((state) => {
          const currentVersion = state.activeVersion;

          if (!currentVersion) {
            return;
          }

          commitNormalizedVersionDraft(state, {
            ...currentVersion,
            mep: data.mep,
            scores: currentVersion.scores
              ? {
                  ...currentVersion.scores,
                  mepAlignmentScore: Math.min(100, currentVersion.scores.mepAlignmentScore + 4)
                }
              : currentVersion.scores
          });

          if (data.warning) {
            state.mepError = `Fallback MEP generated: ${data.warning}`;
          }
        })
      );
    } catch (error) {
      set(
        produce<EvoProjectStore>((state) => {
          state.mepError = error instanceof Error ? error.message : "Failed to generate MEP.";
        })
      );
    } finally {
      set(
        produce<EvoProjectStore>((state) => {
          state.isGeneratingMep = false;
        })
      );
    }
  },
  openModelForVersion: (version) =>
    set(
      produce<EvoProjectStore>((state) => {
        commitNormalizedVersionDraft(state, normalizePlanVersion(version), true);
        state.activeTab = "Model";
      })
    ),
  refineVersion: (version) =>
    set(
      produce<EvoProjectStore>((state) => {
        commitNormalizedVersionDraft(state, normalizePlanVersion(version), true);
        state.activeTab = "Plan";
      })
    ),
  returnToPlanGeneration: () =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeTab = "Plan";
      })
    )
}));

export function EvoProjectProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function getEvoProjectSnapshot() {
  return useEvoProjectStore.getState();
}

export function useEvoProject(): EvoProjectStore;
export function useEvoProject<T>(selector: (state: EvoProjectStore) => T): T;
export function useEvoProject<T>(selector?: (state: EvoProjectStore) => T) {
  return useEvoProjectStore(selector ?? ((state) => state as T));
}
