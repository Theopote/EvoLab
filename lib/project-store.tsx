"use client";

import { produce } from "immer";
import { type ReactNode } from "react";
import { create } from "zustand";
import { normalizePlanVersion, normalizeProjectVersions } from "@/lib/architecture-model";
import { initialProjectData } from "@/lib/evolab-data";
import { calculateQuantities, checkCompliance, type ComplianceItem, type QuantityResult } from "@/lib/quantity-engine";
import { computeBuildableEnvelope } from "@/lib/buildable-envelope";
import type { BuildableEnvelope, EnvironmentSurrogate, SiteContext, ZoningConstraints } from "@/lib/site-types";
import { computeEnvironmentSurrogate } from "@/lib/environment-surrogate";
import { isOutlineStale } from "@/lib/outline-sync";
import { polygonArea } from "@/lib/plan-validation";
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
  complianceItems: ComplianceItem[];
  outlineStale: boolean;
  isRelayouting: boolean;
  relayoutError: string | null;
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
  updateWall: (wallId: string, patch: Partial<Wall>) => void;
  updateOpening: (openingId: string, patch: Partial<OpeningElement>) => void;
  replaceVersions: (versions: PlanVersion[], projectType?: string) => void;
  appendGeneratedVersions: (versions: PlanVersion[], projectType?: string) => void;
  setActiveVersion: (version: PlanVersion) => void;
  updateActiveVersion: (version: PlanVersion) => void;
  relayoutActiveVersion: () => Promise<void>;
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
    const rooms = level?.rooms.length ? level.rooms : version.rooms;
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

function syncOutlineFromVersionDraft(state: EvoProjectStore, version: PlanVersion) {
  if (version.outline.length < 3) {
    return;
  }

  state.outline = version.outline;
  state.outlineClosed = true;
  refreshSiteDerivedDraft(state);
  refreshOutlineSyncDraft(state);
}

function refreshDerivedDraft(state: EvoProjectStore) {
  const activeVersion = getActiveVersion(state.project);
  const activeLevel = getLevel(activeVersion, state.activeLevelId);

  state.activeVersion = activeVersion;
  state.activeLevelId = activeLevel?.id;
  state.activeLevel = activeLevel;
  state.quantities = activeVersion ? calculateQuantities(activeVersion) : undefined;
  state.complianceItems = activeVersion ? checkCompliance(activeVersion) : [];
  state.selectedRoom = (activeLevel?.rooms.length ? activeLevel.rooms : activeVersion?.rooms)?.find(
    (room) => room.id === state.selectedRoomId
  );
  state.selectedWall = activeLevel?.walls.find((wall) => wall.id === state.selectedWallId);
  state.selectedOpening = activeLevel?.openings.find((opening) => opening.id === state.selectedOpeningId);

  validateSelectionDraft(state);
  refreshOutlineSyncDraft(state);
}

function bumpGeometryRevision(state: EvoProjectStore) {
  state.geometryRevision += 1;
}

const ROOM_GEOMETRY_KEYS = new Set(["polygon", "doors", "windows"]);
const WALL_GEOMETRY_KEYS = new Set(["start", "end", "thickness", "height"]);
const OPENING_GEOMETRY_KEYS = new Set(["center", "width", "height", "sillHeight", "wallId"]);

function patchTouchesGeometry<T extends object>(patch: Partial<T>, geometryKeys: Set<string>) {
  return Object.keys(patch).some((key) => geometryKeys.has(key));
}

function refreshQuantitiesDraft(state: EvoProjectStore) {
  state.quantities = state.activeVersion ? calculateQuantities(state.activeVersion) : undefined;
  state.complianceItems = state.activeVersion ? checkCompliance(state.activeVersion) : [];
}

function applyRoomPatchToVersion(
  version: PlanVersion,
  levelId: string | undefined,
  roomId: string,
  patch: Partial<Room>
): PlanVersion | undefined {
  const level = getLevel(version, levelId);

  if (!level?.rooms.some((room) => room.id === roomId)) {
    return undefined;
  }

  const nextLevels = version.levels.map((item) => ({
    ...item,
    rooms: item.rooms.map((room) => {
      if (room.id !== roomId) {
        return room;
      }

      const nextRoom = { ...room, ...patch, id: room.id };

      if (patch.polygon) {
        nextRoom.areaSqm = Number(polygonArea(patch.polygon).toFixed(1));
      }

      return nextRoom;
    })
  }));

  return {
    ...version,
    rooms: nextLevels.flatMap((item) => item.rooms),
    levels: nextLevels,
    building: {
      ...version.building,
      levels: nextLevels
    }
  };
}

function commitNormalizedVersionDraft(
  state: EvoProjectStore,
  normalizedVersion: PlanVersion,
  resetSelection = false,
  bumpGeometry = true
) {
  state.project.versions = state.project.versions.some((item) => item.id === normalizedVersion.id)
    ? state.project.versions.map((item) => (item.id === normalizedVersion.id ? normalizedVersion : item))
    : [...state.project.versions, normalizedVersion];
  state.project.activeVersionId = normalizedVersion.id;

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
  | "updateWall"
  | "updateOpening"
  | "replaceVersions"
  | "appendGeneratedVersions"
  | "setActiveVersion"
  | "updateActiveVersion"
  | "relayoutActiveVersion"
  | "generateMep"
  | "openModelForVersion"
  | "refineVersion"
  | "returnToPlanGeneration"
> {
  const activeVersion = getActiveVersion(initialProjectData);
  const activeLevel = getLevel(activeVersion, undefined);

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
    activeAnalysisLayers: ["function_zones", "patient_flow", "egress_path", "daylight"],
    activeMepLayers: ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "shafts", "equipment_rooms"],
    isGeneratingMep: false,
    mepError: null,
    quantities: activeVersion ? calculateQuantities(activeVersion) : undefined,
    complianceItems: activeVersion ? checkCompliance(activeVersion) : [],
    outlineStale: false,
    isRelayouting: false,
    relayoutError: null
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

        if (patchTouchesGeometry(patch, ROOM_GEOMETRY_KEYS)) {
          const normalized = normalizePlanVersion(state.activeVersion);
          const nextVersion = applyRoomPatchToVersion(normalized, state.activeLevelId, roomId, patch);

          if (!nextVersion) {
            return;
          }

          commitNormalizedVersionDraft(state, normalizePlanVersion(nextVersion));
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

        const normalized = normalizePlanVersion(state.activeVersion);
        const nextVersion = applyRoomPatchToVersion(normalized, state.activeLevelId, roomId, patch);

        if (!nextVersion) {
          return;
        }

        commitNormalizedVersionDraft(state, normalizePlanVersion(nextVersion));
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

        state.project.projectType = projectType;
        state.project.versions = [...state.project.versions, ...normalizedVersions];
        state.project.activeVersionId = normalizedVersions[0]?.id ?? state.project.activeVersionId;
        clearSelectionDraft(state);
        bumpGeometryRevision(state);
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
  updateActiveVersion: (version) =>
    set(
      produce<EvoProjectStore>((state) => {
        commitNormalizedVersionDraft(state, normalizePlanVersion(version));
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
          commitNormalizedVersionDraft(state, normalizePlanVersion(data.version!), true);
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
