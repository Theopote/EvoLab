"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PlanBrief } from "@/components/plan-editor/BriefForm";
import type { WorkspaceTab } from "@/components/top-nav";
import { initialProjectData } from "@/lib/evolab-data";
import { calculateQuantities, checkCompliance, type ComplianceItem, type QuantityResult } from "@/lib/quantity-engine";
import type { AnalysisLayerId, MepLayout, PlanVersion, Point, ProjectData } from "@/lib/project-types";
import type { MepLayerId } from "@/components/mep/MepLayerList";

const defaultOutline: Point[] = [
  [0, 0],
  [72, 0],
  [72, 42],
  [0, 42]
];

const defaultBrief: PlanBrief = {
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
  outline: Point[];
  outlineClosed: boolean;
  brief: PlanBrief;
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
  setBrief: (brief: PlanBrief) => void;
  setActiveAnalysisLayers: (layers: AnalysisLayerId[]) => void;
  setActiveMepLayers: (layers: MepLayerId[]) => void;
  handleGenerated: (versions: PlanVersion[]) => void;
  handleSelectVersion: (version: PlanVersion) => void;
  handleVersionUpdated: (version: PlanVersion) => void;
  handleGenerateMep: () => Promise<void>;
  handleGenerateModel: (version: PlanVersion) => void;
  handleRefineVersion: (version: PlanVersion) => void;
  handleCopilotRegenerate: () => void;
}

const EvoProjectContext = createContext<EvoProjectContextValue | null>(null);

export function EvoProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectData>(initialProjectData);
  const [outline, setOutline] = useState<Point[]>(defaultOutline);
  const [outlineClosed, setOutlineClosed] = useState(true);
  const [brief, setBrief] = useState<PlanBrief>(defaultBrief);
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

  function handleGenerated(versions: PlanVersion[]) {
    setProject((current) => ({
      ...current,
      projectType: brief.projectType,
      versions,
      activeVersionId: versions[0]?.id ?? current.activeVersionId
    }));
  }

  function handleSelectVersion(version: PlanVersion) {
    setProject((current) => {
      const exists = current.versions.some((item) => item.id === version.id);

      return {
        ...current,
        versions: exists ? current.versions : [...current.versions, version],
        activeVersionId: version.id
      };
    });
  }

  function handleVersionUpdated(version: PlanVersion) {
    setProject((current) => {
      const nextVersions = current.versions.some((item) => item.id === version.id)
        ? current.versions.map((item) => (item.id === version.id ? version : item))
        : [...current.versions, version];

      return {
        ...current,
        versions: nextVersions,
        activeVersionId: version.id
      };
    });
  }

  function handleCopilotRegenerate() {
    setActiveTab("Plan");
  }

  function handleGenerateModel(version: PlanVersion) {
    handleSelectVersion(version);
    setActiveTab("Model");
  }

  function handleRefineVersion(version: PlanVersion) {
    handleSelectVersion(version);
    setActiveTab("Plan");
  }

  async function handleGenerateMep() {
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

      handleVersionUpdated({
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
      setBrief,
      setActiveAnalysisLayers,
      setActiveMepLayers,
      handleGenerated,
      handleSelectVersion,
      handleVersionUpdated,
      handleGenerateMep,
      handleGenerateModel,
      handleRefineVersion,
      handleCopilotRegenerate
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
      quantities
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
