import { getResolvedLevel } from "@/lib/level-rooms";
import { computeBuildableEnvelope } from "@/lib/buildable-envelope";
import { computeEnvironmentSurrogate } from "@/lib/environment-surrogate";
import { initialProjectData } from "@/lib/evolab-data";
import { getActiveSchedule, getCodeContext, getRulePack } from "@/lib/project-domain";
import { calculateQuantities, checkCompliance } from "@/lib/quantity-engine";
import { defaultZoningConstraints } from "@/lib/site-types";
import { defaultBrief, defaultOutline } from "@/lib/store/defaults";
import { getActiveVersion, getLevel } from "@/lib/store/draft-helpers";
import type { EvoProjectStoreData } from "@/lib/store/types";

export function createInitialState(): EvoProjectStoreData {
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
    workflowPhase: "site",
    compareVersionIds: [],
    compareModeOpen: false,
    selectedProposalId: undefined,
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
