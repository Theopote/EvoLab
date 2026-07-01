import type { EvoProjectStore, WallDragCommitInput } from "@/lib/store/types";

export type { WallDragCommitInput };

export type ProjectSliceActions = Pick<
  EvoProjectStore,
  | "setActiveTab"
  | "updateBrief"
  | "setProjectTypology"
  | "updateProjectIntake"
  | "loadDemoProject"
  | "createNewProject"
  | "renameProject"
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
  | "setCompareVersionIds"
  | "setCompareModeOpen"
  | "setActiveLevel"
  | "setMetricsScope"
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
  | "applyWallDragCommit"
  | "mergeSelectedWallWith"
  | "splitSelectedWallAt"
  | "splitActiveRoom"
  | "mergeActiveRoomWith"
  | "addParametricOpening"
  | "updateWall"
  | "updateOpening"
>;

export type HistorySliceActions = Pick<
  EvoProjectStore,
  "undoProjectEdit" | "redoProjectEdit" | "hydrateWorkspaceSnapshot" | "clearEditHistory"
>;

export type HistorySliceState = Pick<EvoProjectStore, "undoStack" | "redoStack">;

export type ExportSliceActions = Pick<
  EvoProjectStore,
  "openModelForVersion" | "refineVersion" | "returnToPlanGeneration"
>;

export type PresentationSliceActions = Pick<
  EvoProjectStore,
  | "savePresentationSession"
  | "clearPresentationSession"
  | "setPresentationActiveSlide"
  | "setPresentationTemplateId"
  | "updatePresentationSlide"
  | "updatePresentationDeckMeta"
  | "removePresentationSlide"
  | "movePresentationSlide"
>;

export type PresentationSliceState = Pick<EvoProjectStore, "presentationSessions">;

export type ProjectSliceState = Pick<
  EvoProjectStore,
  | "project"
  | "activeVersion"
  | "activeLevelId"
  | "activeLevel"
  | "geometryRevision"
  | "brief"
  | "workflowPhase"
  | "compareVersionIds"
  | "compareModeOpen"
  | "compareLevelId"
  | "outlineStale"
  | "isRelayouting"
  | "relayoutError"
  | "activeTab"
>;

export type SelectionSliceState = Pick<
  EvoProjectStore,
  | "selectedRoomId"
  | "selectedWallId"
  | "selectedOpeningId"
  | "selectionType"
  | "selectedRoom"
  | "selectedWall"
  | "selectedOpening"
>;

export type SiteSliceState = Pick<
  EvoProjectStore,
  | "outline"
  | "outlineClosed"
  | "siteContext"
  | "siteAddressQuery"
  | "isFetchingSite"
  | "siteError"
  | "zoning"
  | "buildableEnvelope"
  | "environmentSurrogate"
  | "showSiteContextLayer"
  | "showEnvironmentOverlay"
>;

export type AnalysisSliceState = Pick<
  EvoProjectStore,
  | "quantities"
  | "levelQuantities"
  | "scopedQuantities"
  | "metricsScope"
  | "activeSchedule"
  | "complianceItems"
  | "activeAnalysisLayers"
  | "activeMepLayers"
  | "isGeneratingMep"
  | "mepError"
>;

export type ReviewSliceState = Pick<EvoProjectStore, "selectedProposalId" | "selectedChangeSetId"> & {
  lockedElementIds: string[];
  copilotProposals: EvoProjectStore["project"]["domain"]["copilotProposals"];
  copilotInsightQueue: EvoProjectStore["project"]["domain"]["copilotInsightQueue"];
  changeSets: EvoProjectStore["project"]["domain"]["changeSets"];
  scoringConfig: EvoProjectStore["project"]["domain"]["scoringConfig"];
};

export type ProjectSlice = ProjectSliceState & ProjectSliceActions;
export type SelectionSlice = SelectionSliceState & SelectionSliceActions;
export type SiteSlice = SiteSliceState & SiteSliceActions;
export type AnalysisSlice = AnalysisSliceState & AnalysisSliceActions;
export type ReviewSlice = ReviewSliceState & ReviewSliceActions;
export type PresentationSlice = PresentationSliceState & PresentationSliceActions;
export type GeometrySlice = GeometrySliceActions;
export type ExportSlice = ExportSliceActions;

export type SelectionEditorSlice = SelectionSliceState &
  SelectionSliceActions &
  GeometrySliceActions &
  Pick<EvoProjectStore, "activeLevelId"> & {
    lockedElementIds: string[];
  };
