"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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

interface EvoProjectContextValue {
  project: ProjectData;
  activeVersion?: PlanVersion;
  selectedRoomId?: string;
  selectedWallId?: string;
  selectedOpeningId?: string;
  selectionType: "none" | "room" | "wall" | "opening";
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

const EvoProjectContext = createContext<EvoProjectContextValue | null>(null);

export function EvoProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectData>(initialProjectData);
  const [outline, setOutline] = useState<Point[]>(defaultOutline);
  const [outlineClosed, setOutlineClosed] = useState(true);
  const [brief, setBrief] = useState<DesignBrief>(defaultBrief);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Plan");
  const [activeAnalysisLayers, setActiveAnalysisLayers] = useState<AnalysisLayerId[]>([
    "function_zones",
    "patient_flow",
    "egress_path",
    "daylight"
  ]);
  const [activeMepLayers, setActiveMepLayers] = useState<MepLayerId[]>([
    "hvac",
    "plumbing_supply",
    "plumbing_drain",
    "electrical",
    "shafts",
    "equipment_rooms"
  ]);
  const [isGeneratingMep, setIsGeneratingMep] = useState(false);
  const [mepError, setMepError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [selectedWallId, setSelectedWallId] = useState<string | undefined>(undefined);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | undefined>(undefined);
  const [selectionType, setSelectionType] = useState<"none" | "room" | "wall" | "opening">("none");

  const activeVersion = useMemo(
    () => project.versions.find((version) => version.id === project.activeVersionId),
    [project.activeVersionId, project.versions]
  );
  const quantities = useMemo(
    () => (activeVersion ? calculateQuantities(activeVersion) : undefined),
    [activeVersion]
  );
  const complianceItems = useMemo(
    () => (activeVersion ? checkCompliance(activeVersion) : []),
    [activeVersion]
  );
  const selectedRoom = useMemo(
    () => activeVersion?.rooms.find((room) => room.id === selectedRoomId),
    [activeVersion, selectedRoomId]
  );
  const selectedWall = useMemo(
    () => activeVersion?.levels[0]?.walls.find((wall) => wall.id === selectedWallId),
    [activeVersion, selectedWallId]
  );
  const selectedOpening = useMemo(
    () => activeVersion?.levels[0]?.openings.find((opening) => opening.id === selectedOpeningId),
    [activeVersion, selectedOpeningId]
  );

  function clearSelection() {
    setSelectionType("none");
    setSelectedRoomId(undefined);
    setSelectedWallId(undefined);
    setSelectedOpeningId(undefined);
  }

  function selectRoom(roomId: string) {
    setSelectionType("room");
    setSelectedRoomId(roomId);
    setSelectedWallId(undefined);
    setSelectedOpeningId(undefined);
  }

  function selectWall(wallId: string) {
    setSelectionType("wall");
    setSelectedWallId(wallId);
    setSelectedRoomId(undefined);
    setSelectedOpeningId(undefined);
  }

  function selectOpening(openingId: string) {
    setSelectionType("opening");
    setSelectedOpeningId(openingId);
    setSelectedRoomId(undefined);
    setSelectedWallId(undefined);
  }

  function validateSelectionForVersion(version: PlanVersion) {
    if (selectionType === "room") {
      if (selectedRoomId && version.rooms.some((room) => room.id === selectedRoomId)) {
        return;
      }
      clearSelection();
      return;
    }

    if (selectionType === "wall") {
      if (selectedWallId && version.levels[0]?.walls.some((wall) => wall.id === selectedWallId)) {
        return;
      }
      clearSelection();
      return;
    }

    if (selectionType === "opening") {
      if (selectedOpeningId && version.levels[0]?.openings.some((opening) => opening.id === selectedOpeningId)) {
        return;
      }
      clearSelection();
    }
  }

  function commitNormalizedVersion(normalizedVersion: PlanVersion, resetSelection = false) {
    setProject((current) => {
      const nextVersions = current.versions.some((item) => item.id === normalizedVersion.id)
        ? current.versions.map((item) => (item.id === normalizedVersion.id ? normalizedVersion : item))
        : [...current.versions, normalizedVersion];

      return {
        ...current,
        versions: nextVersions,
        activeVersionId: normalizedVersion.id
      };
    });

    if (resetSelection) {
      clearSelection();
      return;
    }

    validateSelectionForVersion(normalizedVersion);
  }

  function commitVersionUpdate(version: PlanVersion, resetSelection = false) {
    commitNormalizedVersion(normalizePlanVersion(version), resetSelection);
  }

  function updateBrief(nextBrief: DesignBrief) {
    setBrief(nextBrief);
  }

  function replaceVersions(versions: PlanVersion[], projectType = brief.projectType) {
    const normalizedVersions = normalizeProjectVersions(versions);

    setProject((current) => ({
      ...current,
      projectType,
      versions: normalizedVersions,
      activeVersionId: normalizedVersions[0]?.id ?? current.activeVersionId
    }));

    clearSelection();
  }

  function setActiveVersion(version: PlanVersion) {
    commitVersionUpdate(version, true);
  }

  function updateActiveVersion(version: PlanVersion) {
    commitVersionUpdate(version);
  }

  function updateRoom(roomId: string, patch: Partial<Room>) {
    if (!activeVersion) {
      return;
    }

    const roomExists = activeVersion.rooms.some((room) => room.id === roomId);

    if (!roomExists) {
      return;
    }

    const nextVersion: PlanVersion = {
      ...activeVersion,
      rooms: activeVersion.rooms.map((room) => (room.id === roomId ? { ...room, ...patch, id: room.id } : room))
    };

    commitVersionUpdate(nextVersion);
  }

  function updateWall(wallId: string, patch: Partial<Wall>) {
    if (!activeVersion) {
      return;
    }

    const normalized = normalizePlanVersion(activeVersion);
    const level = normalized.levels[0];

    if (!level?.walls.some((wall) => wall.id === wallId)) {
      return;
    }

    const nextLevels = normalized.levels.map((item) => {
      if (item.id !== level.id) {
        return item;
      }

      return {
        ...item,
        walls: item.walls.map((wall) => (wall.id === wallId ? { ...wall, ...patch, id: wall.id } : wall))
      };
    });

    commitNormalizedVersion({
      ...normalized,
      levels: nextLevels,
      building: {
        ...normalized.building,
        levels: nextLevels
      }
    });
  }

  function updateOpening(openingId: string, patch: Partial<OpeningElement>) {
    if (!activeVersion) {
      return;
    }

    const normalized = normalizePlanVersion(activeVersion);
    const level = normalized.levels[0];

    if (!level?.openings.some((opening) => opening.id === openingId)) {
      return;
    }

    const nextLevels = normalized.levels.map((item) => {
      if (item.id !== level.id) {
        return item;
      }

      return {
        ...item,
        openings: item.openings.map((opening) =>
          opening.id === openingId ? { ...opening, ...patch, id: opening.id } : opening
        )
      };
    });

    commitNormalizedVersion({
      ...normalized,
      levels: nextLevels,
      building: {
        ...normalized.building,
        levels: nextLevels
      }
    });
  }

  function returnToPlanGeneration() {
    setActiveTab("Plan");
  }

  function openModelForVersion(version: PlanVersion) {
    setActiveVersion(version);
    setActiveTab("Model");
  }

  function refineVersion(version: PlanVersion) {
    setActiveVersion(version);
    setActiveTab("Plan");
  }

  async function generateMep() {
    if (!activeVersion || isGeneratingMep) {
      return;
    }

    setIsGeneratingMep(true);
    setMepError(null);

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

      updateActiveVersion({
        ...activeVersion,
        mep: data.mep,
        scores: activeVersion.scores
          ? {
              ...activeVersion.scores,
              mepAlignmentScore: Math.min(100, activeVersion.scores.mepAlignmentScore + 4)
            }
          : activeVersion.scores
      });

      if (data.warning) {
        setMepError(`Fallback MEP generated: ${data.warning}`);
      }
    } catch (error) {
      setMepError(error instanceof Error ? error.message : "Failed to generate MEP.");
    } finally {
      setIsGeneratingMep(false);
    }
  }

  const value = useMemo(
    () => ({
      project,
      activeVersion,
      selectedRoomId,
      selectedWallId,
      selectedOpeningId,
      selectionType,
      selectedRoom,
      selectedWall,
      selectedOpening,
      outline,
      outlineClosed,
      brief,
      activeTab,
      activeAnalysisLayers,
      activeMepLayers,
      isGeneratingMep,
      mepError,
      quantities,
      complianceItems,
      setActiveTab,
      setOutline,
      setOutlineClosed,
      updateBrief,
      setActiveAnalysisLayers,
      setActiveMepLayers,
      selectRoom,
      selectWall,
      selectOpening,
      clearSelection,
      updateRoom,
      updateWall,
      updateOpening,
      replaceVersions,
      setActiveVersion,
      updateActiveVersion,
      generateMep,
      openModelForVersion,
      refineVersion,
      returnToPlanGeneration
    }),
    [
      activeAnalysisLayers,
      activeMepLayers,
      activeTab,
      activeVersion,
      brief,
      complianceItems,
      isGeneratingMep,
      mepError,
      outline,
      outlineClosed,
      project,
      quantities,
      selectedOpening,
      selectedOpeningId,
      selectedRoom,
      selectedRoomId,
      selectedWall,
      selectedWallId,
      selectionType
    ]
  );

  return <EvoProjectContext.Provider value={value}>{children}</EvoProjectContext.Provider>;
}

export function useEvoProject() {
  const context = useContext(EvoProjectContext);

  if (!context) {
    throw new Error("useEvoProject must be used within EvoProjectProvider.");
  }

  return context;
}
