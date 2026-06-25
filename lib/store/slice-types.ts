import type { EvoProjectStore } from "@/lib/store/types";

export type ProjectSliceActions = Pick<
  EvoProjectStore,
  | "setActiveTab"
  | "updateBrief"
  | "updateScoringConfig"
  | "resetScoringConfig"
  | "updateFacadeEnvelope"
  | "updateFacadeZone"
  | "updateFurnitureItem"
  | "updateStructuralSystem"
  | "resetDerivedEnvelopeSystems"
  | "updateTopologyGraph"
  | "setWorkflowPhase"
  | "toggleCompareVersion"
  | "setCompareModeOpen"
  | "setActiveLevel"
  | "setLevelTransferFloor"
  | "setCompareLevel"
  | "replaceVersions"
  | "appendGeneratedVersions"
  | "setActiveVersion"
  | "updateActiveVersion"
  | "relayoutActiveVersion"
>;

export type SelectionSliceActions = Pick<
  EvoProjectStore,
  "selectRoom" | "selectWall" | "selectOpening" | "clearSelection" | "toggleElementLock"
>;

export type SiteSliceActions = Pick<
  EvoProjectStore,
  | "setOutline"
  | "setOutlineClosed"
  | "setZoning"
  | "setSiteAddressQuery"
  | "fetchSiteContext"
  | "applySuggestedSiteOutline"
  | "setShowSiteContextLayer"
  | "setShowEnvironmentOverlay"
  | "refreshEnvironmentSurrogate"
>;

export type AnalysisSliceActions = Pick<
  EvoProjectStore,
  "setActiveAnalysisLayers" | "setActiveMepLayers" | "generateMep"
>;

export type ReviewSliceActions = Pick<
  EvoProjectStore,
  | "selectCopilotProposal"
  | "registerCopilotProposal"
  | "applyCopilotProposal"
  | "dismissCopilotProposal"
  | "addCopilotProposalComment"
  | "refreshCopilotInsights"
  | "reviewCopilotInsights"
  | "recordDesignDecision"
  | "selectChangeSet"
  | "approveChangeSet"
  | "rejectChangeSet"
>;

export type GeometrySliceActions = Pick<
  EvoProjectStore,
  | "updateRoom"
  | "updateRoomGeometry"
  | "applyLevelRoomsGeometry"
  | "splitActiveRoom"
  | "mergeActiveRoomWith"
  | "addParametricOpening"
  | "updateWall"
  | "updateOpening"
>;

export type ExportSliceActions = Pick<
  EvoProjectStore,
  "openModelForVersion" | "refineVersion" | "returnToPlanGeneration"
>;
