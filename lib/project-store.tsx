"use client";

import { produce } from "immer";
import { type ReactNode } from "react";
import { create } from "zustand";
import { normalizePlanVersion, normalizeProjectVersions } from "@/lib/architecture-model";
import { initialProjectData } from "@/lib/evolab-data";
import { calculateQuantities, checkCompliance, type ComplianceItem, type QuantityResult } from "@/lib/quantity-engine";
import type {
  AnalysisLayerId,
  DesignBrief,
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
  selectedRoomId?: string;
  selectedWallId?: string;
  selectedOpeningId?: string;
  selectionType: SelectionType;
  selectedRoom?: Room;
  selectedWall?: Wall;
  selectedOpening?: OpeningElement;
  outline: Point[];
  outlineClosed: boolean;
  brief: DesignBrief;
  activeTab: WorkspaceTab;
  activeAnalysisLayers: AnalysisLayerId[];
  activeMepLayers: MepLayerId[];
  isGeneratingMep: boolean;
  mepError: string | null;
  quantities?: QuantityResult;
  complianceItems: ComplianceItem[];
  setActiveTab: (tab: WorkspaceTab) => void;
  setOutline: (outline: Point[]) => void;
  setOutlineClosed: (closed: boolean) => void;
  updateBrief: (brief: DesignBrief) => void;
  setActiveAnalysisLayers: (layers: AnalysisLayerId[]) => void;
  setActiveMepLayers: (layers: MepLayerId[]) => void;
  selectRoom: (roomId: string) => void;
  selectWall: (wallId: string) => void;
  selectOpening: (openingId: string) => void;
  clearSelection: () => void;
  updateRoom: (roomId: string, patch: Partial<Room>) => void;
  updateWall: (wallId: string, patch: Partial<Wall>) => void;
  updateOpening: (openingId: string, patch: Partial<OpeningElement>) => void;
  replaceVersions: (versions: PlanVersion[], projectType?: string) => void;
  setActiveVersion: (version: PlanVersion) => void;
  updateActiveVersion: (version: PlanVersion) => void;
  generateMep: () => Promise<void>;
  openModelForVersion: (version: PlanVersion) => void;
  refineVersion: (version: PlanVersion) => void;
  returnToPlanGeneration: () => void;
}

function getActiveVersion(project: ProjectData) {
  return project.versions.find((version) => version.id === project.activeVersionId);
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

  if (!version || state.selectionType === "none") {
    if (!version) {
      clearSelectionDraft(state);
    }
    return;
  }

  if (state.selectionType === "room") {
    if (!state.selectedRoomId || !version.rooms.some((room) => room.id === state.selectedRoomId)) {
      clearSelectionDraft(state);
    }
    return;
  }

  if (state.selectionType === "wall") {
    if (!state.selectedWallId || !version.levels[0]?.walls.some((wall) => wall.id === state.selectedWallId)) {
      clearSelectionDraft(state);
    }
    return;
  }

  if (!state.selectedOpeningId || !version.levels[0]?.openings.some((opening) => opening.id === state.selectedOpeningId)) {
    clearSelectionDraft(state);
  }
}

function refreshDerivedDraft(state: EvoProjectStore) {
  const activeVersion = getActiveVersion(state.project);

  state.activeVersion = activeVersion;
  state.quantities = activeVersion ? calculateQuantities(activeVersion) : undefined;
  state.complianceItems = activeVersion ? checkCompliance(activeVersion) : [];
  state.selectedRoom = activeVersion?.rooms.find((room) => room.id === state.selectedRoomId);
  state.selectedWall = activeVersion?.levels[0]?.walls.find((wall) => wall.id === state.selectedWallId);
  state.selectedOpening = activeVersion?.levels[0]?.openings.find((opening) => opening.id === state.selectedOpeningId);

  validateSelectionDraft(state);
}

function commitNormalizedVersionDraft(state: EvoProjectStore, normalizedVersion: PlanVersion, resetSelection = false) {
  state.project.versions = state.project.versions.some((item) => item.id === normalizedVersion.id)
    ? state.project.versions.map((item) => (item.id === normalizedVersion.id ? normalizedVersion : item))
    : [...state.project.versions, normalizedVersion];
  state.project.activeVersionId = normalizedVersion.id;

  if (resetSelection) {
    clearSelectionDraft(state);
  }

  refreshDerivedDraft(state);
}

function createInitialState(): Omit<
  EvoProjectStore,
  | "setActiveTab"
  | "setOutline"
  | "setOutlineClosed"
  | "updateBrief"
  | "setActiveAnalysisLayers"
  | "setActiveMepLayers"
  | "selectRoom"
  | "selectWall"
  | "selectOpening"
  | "clearSelection"
  | "updateRoom"
  | "updateWall"
  | "updateOpening"
  | "replaceVersions"
  | "setActiveVersion"
  | "updateActiveVersion"
  | "generateMep"
  | "openModelForVersion"
  | "refineVersion"
  | "returnToPlanGeneration"
> {
  const activeVersion = getActiveVersion(initialProjectData);

  return {
    project: initialProjectData,
    activeVersion,
    selectedRoomId: undefined,
    selectedWallId: undefined,
    selectedOpeningId: undefined,
    selectionType: "none",
    selectedRoom: undefined,
    selectedWall: undefined,
    selectedOpening: undefined,
    outline: defaultOutline,
    outlineClosed: true,
    brief: defaultBrief,
    activeTab: "Plan",
    activeAnalysisLayers: ["function_zones", "patient_flow", "egress_path", "daylight"],
    activeMepLayers: ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "shafts", "equipment_rooms"],
    isGeneratingMep: false,
    mepError: null,
    quantities: activeVersion ? calculateQuantities(activeVersion) : undefined,
    complianceItems: activeVersion ? checkCompliance(activeVersion) : []
  };
}

export const useEvoProjectStore = create<EvoProjectStore>((set, get) => ({
  ...createInitialState(),
  setActiveTab: (tab) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeTab = tab;
      })
    ),
  setOutline: (outline) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.outline = outline;
      })
    ),
  setOutlineClosed: (closed) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.outlineClosed = closed;
      })
    ),
  updateBrief: (brief) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.brief = brief;
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
        if (!state.activeVersion?.rooms.some((room) => room.id === roomId)) {
          return;
        }

        commitNormalizedVersionDraft(
          state,
          normalizePlanVersion({
            ...state.activeVersion,
            rooms: state.activeVersion.rooms.map((room) => (room.id === roomId ? { ...room, ...patch, id: room.id } : room))
          })
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
        const level = normalized.levels[0];

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

        commitNormalizedVersionDraft(state, {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        });
      })
    ),
  updateOpening: (openingId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = normalized.levels[0];

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

        commitNormalizedVersionDraft(state, {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        });
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
        refreshDerivedDraft(state);
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
