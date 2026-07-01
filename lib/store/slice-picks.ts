import type { EvoProjectStore } from "@/lib/store/types";
import type {
  AnalysisSlice,
  AnalysisSliceActions,
  AnalysisSliceState,
  ExportSliceActions,
  GeometrySliceActions,
  PresentationSlice,
  PresentationSliceActions,
  PresentationSliceState,
  ProjectSlice,
  ProjectSliceActions,
  ProjectSliceState,
  ReviewSlice,
  ReviewSliceActions,
  ReviewSliceState,
  SelectionEditorSlice,
  SelectionSlice,
  SelectionSliceActions,
  SelectionSliceState,
  SiteSlice,
  SiteSliceActions,
  SiteSliceState
} from "@/lib/store/slice-types";

export function pickProjectState(state: EvoProjectStore): ProjectSliceState {
  return {
    project: state.project,
    activeVersion: state.activeVersion,
    activeLevelId: state.activeLevelId,
    activeLevel: state.activeLevel,
    geometryRevision: state.geometryRevision,
    brief: state.brief,
    workflowPhase: state.workflowPhase,
    compareVersionIds: state.compareVersionIds,
    compareModeOpen: state.compareModeOpen,
    compareLevelId: state.compareLevelId,
    outlineStale: state.outlineStale,
    isRelayouting: state.isRelayouting,
    relayoutError: state.relayoutError,
    activeTab: state.activeTab
  };
}

export function pickProjectActions(state: EvoProjectStore): ProjectSliceActions {
  return {
    setActiveTab: state.setActiveTab,
    updateBrief: state.updateBrief,
    setProjectTypology: state.setProjectTypology,
    updateProjectIntake: state.updateProjectIntake,
    loadDemoProject: state.loadDemoProject,
    createNewProject: state.createNewProject,
    renameProject: state.renameProject,
    updateScoringConfig: state.updateScoringConfig,
    resetScoringConfig: state.resetScoringConfig,
    updateFacadeEnvelope: state.updateFacadeEnvelope,
    updateFacadeZone: state.updateFacadeZone,
    updateFurnitureItem: state.updateFurnitureItem,
    updateStructuralSystem: state.updateStructuralSystem,
    resetDerivedEnvelopeSystems: state.resetDerivedEnvelopeSystems,
    updateTopologyGraph: state.updateTopologyGraph,
    setWorkflowPhase: state.setWorkflowPhase,
    toggleCompareVersion: state.toggleCompareVersion,
    setCompareVersionIds: state.setCompareVersionIds,
    setCompareModeOpen: state.setCompareModeOpen,
    setActiveLevel: state.setActiveLevel,
    setMetricsScope: state.setMetricsScope,
    setLevelTransferFloor: state.setLevelTransferFloor,
    setCompareLevel: state.setCompareLevel,
    replaceVersions: state.replaceVersions,
    appendGeneratedVersions: state.appendGeneratedVersions,
    setActiveVersion: state.setActiveVersion,
    updateActiveVersion: state.updateActiveVersion,
    relayoutActiveVersion: state.relayoutActiveVersion
  };
}

export function pickProjectSlice(state: EvoProjectStore): ProjectSlice {
  return {
    ...pickProjectState(state),
    ...pickProjectActions(state)
  };
}

export function pickSelectionState(state: EvoProjectStore): SelectionSliceState {
  return {
    selectedRoomId: state.selectedRoomId,
    selectedWallId: state.selectedWallId,
    selectedOpeningId: state.selectedOpeningId,
    selectionType: state.selectionType,
    selectedRoom: state.selectedRoom,
    selectedWall: state.selectedWall,
    selectedOpening: state.selectedOpening
  };
}

export function pickSelectionActions(state: EvoProjectStore): SelectionSliceActions {
  return {
    selectRoom: state.selectRoom,
    selectWall: state.selectWall,
    selectOpening: state.selectOpening,
    clearSelection: state.clearSelection,
    toggleElementLock: state.toggleElementLock
  };
}

export function pickSelectionSlice(state: EvoProjectStore): SelectionSlice {
  return {
    ...pickSelectionState(state),
    ...pickSelectionActions(state)
  };
}

export function pickGeometryActions(state: EvoProjectStore): GeometrySliceActions {
  return {
    updateRoom: state.updateRoom,
    updateRoomGeometry: state.updateRoomGeometry,
    applyLevelRoomsGeometry: state.applyLevelRoomsGeometry,
    applyWallDragCommit: state.applyWallDragCommit,
    mergeSelectedWallWith: state.mergeSelectedWallWith,
    splitSelectedWallAt: state.splitSelectedWallAt,
    splitActiveRoom: state.splitActiveRoom,
    mergeActiveRoomWith: state.mergeActiveRoomWith,
    addParametricOpening: state.addParametricOpening,
    updateWall: state.updateWall,
    updateOpening: state.updateOpening
  };
}

export function pickSelectionEditorSlice(state: EvoProjectStore): SelectionEditorSlice {
  return {
    ...pickSelectionState(state),
    ...pickSelectionActions(state),
    ...pickGeometryActions(state),
    activeLevelId: state.activeLevelId,
    lockedElementIds: state.project.domain.lockedElementIds
  };
}

export function pickSiteState(state: EvoProjectStore): SiteSliceState {
  return {
    outline: state.outline,
    outlineClosed: state.outlineClosed,
    siteContext: state.siteContext,
    siteAddressQuery: state.siteAddressQuery,
    isFetchingSite: state.isFetchingSite,
    siteError: state.siteError,
    zoning: state.zoning,
    buildableEnvelope: state.buildableEnvelope,
    environmentSurrogate: state.environmentSurrogate,
    showSiteContextLayer: state.showSiteContextLayer,
    showEnvironmentOverlay: state.showEnvironmentOverlay
  };
}

export function pickSiteActions(state: EvoProjectStore): SiteSliceActions {
  return {
    setOutline: state.setOutline,
    setOutlineClosed: state.setOutlineClosed,
    setZoning: state.setZoning,
    setSiteAddressQuery: state.setSiteAddressQuery,
    fetchSiteContext: state.fetchSiteContext,
    applySuggestedSiteOutline: state.applySuggestedSiteOutline,
    setShowSiteContextLayer: state.setShowSiteContextLayer,
    setShowEnvironmentOverlay: state.setShowEnvironmentOverlay,
    refreshEnvironmentSurrogate: state.refreshEnvironmentSurrogate
  };
}

export function pickSiteSlice(state: EvoProjectStore): SiteSlice {
  return {
    ...pickSiteState(state),
    ...pickSiteActions(state)
  };
}

export function pickAnalysisState(state: EvoProjectStore): AnalysisSliceState {
  return {
    quantities: state.quantities,
    levelQuantities: state.levelQuantities,
    scopedQuantities: state.scopedQuantities,
    metricsScope: state.metricsScope,
    activeSchedule: state.activeSchedule,
    complianceItems: state.complianceItems,
    activeAnalysisLayers: state.activeAnalysisLayers,
    activeMepLayers: state.activeMepLayers,
    isGeneratingMep: state.isGeneratingMep,
    mepError: state.mepError
  };
}

export function pickAnalysisActions(state: EvoProjectStore): AnalysisSliceActions {
  return {
    setActiveAnalysisLayers: state.setActiveAnalysisLayers,
    setActiveMepLayers: state.setActiveMepLayers,
    generateMep: state.generateMep
  };
}

export function pickAnalysisSlice(state: EvoProjectStore): AnalysisSlice {
  return {
    ...pickAnalysisState(state),
    ...pickAnalysisActions(state)
  };
}

export function pickReviewState(state: EvoProjectStore): ReviewSliceState {
  return {
    selectedProposalId: state.selectedProposalId,
    selectedChangeSetId: state.selectedChangeSetId,
    lockedElementIds: state.project.domain.lockedElementIds,
    copilotProposals: state.project.domain.copilotProposals,
    copilotInsightQueue: state.project.domain.copilotInsightQueue,
    changeSets: state.project.domain.changeSets,
    scoringConfig: state.project.domain.scoringConfig
  };
}

export function pickReviewActions(state: EvoProjectStore): ReviewSliceActions {
  return {
    selectCopilotProposal: state.selectCopilotProposal,
    registerCopilotProposal: state.registerCopilotProposal,
    applyCopilotProposal: state.applyCopilotProposal,
    dismissCopilotProposal: state.dismissCopilotProposal,
    addCopilotProposalComment: state.addCopilotProposalComment,
    refreshCopilotInsights: state.refreshCopilotInsights,
    reviewCopilotInsights: state.reviewCopilotInsights,
    recordDesignDecision: state.recordDesignDecision,
    selectChangeSet: state.selectChangeSet,
    approveChangeSet: state.approveChangeSet,
    rejectChangeSet: state.rejectChangeSet
  };
}

export function pickReviewSlice(state: EvoProjectStore): ReviewSlice {
  return {
    ...pickReviewState(state),
    ...pickReviewActions(state)
  };
}

export function pickExportActions(state: EvoProjectStore): ExportSliceActions {
  return {
    openModelForVersion: state.openModelForVersion,
    refineVersion: state.refineVersion,
    returnToPlanGeneration: state.returnToPlanGeneration
  };
}

export function pickPresentationState(state: EvoProjectStore): PresentationSliceState {
  return {
    presentationSessions: state.presentationSessions
  };
}

export function pickPresentationActions(state: EvoProjectStore): PresentationSliceActions {
  return {
    savePresentationSession: state.savePresentationSession,
    clearPresentationSession: state.clearPresentationSession,
    setPresentationActiveSlide: state.setPresentationActiveSlide,
    setPresentationTemplateId: state.setPresentationTemplateId,
    updatePresentationSlide: state.updatePresentationSlide,
    updatePresentationDeckMeta: state.updatePresentationDeckMeta,
    removePresentationSlide: state.removePresentationSlide,
    movePresentationSlide: state.movePresentationSlide
  };
}

export function pickPresentationSlice(state: EvoProjectStore): PresentationSlice {
  return {
    ...pickPresentationState(state),
    ...pickPresentationActions(state)
  };
}

export function pickHistoryState(state: EvoProjectStore) {
  return {
    canUndo: state.undoStack.length > 0,
    canRedo: state.redoStack.length > 0
  };
}

export function pickHistoryActions(state: EvoProjectStore) {
  return {
    undoProjectEdit: state.undoProjectEdit,
    redoProjectEdit: state.redoProjectEdit,
    clearEditHistory: state.clearEditHistory
  };
}

export function pickWorkspaceSlice(state: EvoProjectStore) {
  return {
    ...pickProjectSlice(state),
    ...pickSiteSlice(state),
    ...pickAnalysisSlice(state),
    ...pickReviewSlice(state),
    ...pickExportActions(state),
    ...pickSelectionActions(state)
  };
}
