import type {
  ScheduleBundle,
  ScoringConfig,
  FacadeEnvelope,
  StructuralSystem,
  FurnitureItem,
  StoredCopilotProposal
} from "@/lib/building-domain";
import type { BuildableEnvelope, EnvironmentSurrogate, SiteContext, ZoningConstraints } from "@/lib/site-types";
import type {
  AnalysisLayerId,
  DesignBrief,
  Level,
  MepLayerId,
  OpeningElement,
  PlanVersion,
  Point,
  ProjectData,
  Room,
  TopologyGraph,
  Wall,
  WorkspaceTab
} from "@/lib/project-types";
import type { ComplianceItem, QuantityResult } from "@/lib/quantity-engine";
import type { PlanScopeKind } from "@/lib/plan-scope";
import type { PresentationSessionMap } from "@/lib/presentation/session-types";
import type { PresentationDeck, PresentationTemplateId } from "@/lib/presentation/types";
import type { WorkflowPhase, WorkflowPhaseId } from "@/lib/workflow-phases";

export type SelectionType = "none" | "room" | "wall" | "opening";

export type WallDragCommitInput = {
  wallId: string;
  offset: number;
  normal: Point;
};

export interface EvoProjectStore {
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
  compareModeOpen: boolean;
  selectedProposalId?: string;
  activeTab: WorkspaceTab;
  activeAnalysisLayers: AnalysisLayerId[];
  activeMepLayers: MepLayerId[];
  isGeneratingMep: boolean;
  mepError: string | null;
  quantities?: QuantityResult;
  levelQuantities?: QuantityResult;
  scopedQuantities?: QuantityResult;
  metricsScope: PlanScopeKind;
  activeSchedule?: ScheduleBundle;
  complianceItems: ComplianceItem[];
  outlineStale: boolean;
  isRelayouting: boolean;
  relayoutError: string | null;
  compareLevelId?: string;
  selectedChangeSetId?: string;
  presentationSessions: PresentationSessionMap;
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
  setProjectTypology: (typologyId: import("@/lib/typology/types").TypologyPackId) => void;
  updateProjectIntake: (patch: Partial<import("@/lib/intake/project-intake-types").ProjectIntakeRecord>) => void;
  loadDemoProject: (typologyId: import("@/lib/typology/types").TypologyPackId) => void;
  updateScoringConfig: (patch: Partial<ScoringConfig>) => void;
  resetScoringConfig: () => void;
  updateFacadeEnvelope: (patch: Partial<FacadeEnvelope>) => void;
  updateFacadeZone: (
    zoneId: string,
    patch: Partial<Pick<FacadeEnvelope["zones"][number], "strategy" | "targetWindowRatio">>
  ) => void;
  updateFurnitureItem: (itemId: string, patch: Partial<FurnitureItem>) => void;
  updateStructuralSystem: (patch: Partial<StructuralSystem>) => void;
  resetDerivedEnvelopeSystems: () => void;
  updateTopologyGraph: (graph: TopologyGraph) => void;
  setWorkflowPhase: (phase: WorkflowPhaseId) => void;
  toggleCompareVersion: (versionId: string) => void;
  setCompareVersionIds: (versionIds: string[]) => void;
  setCompareModeOpen: (open: boolean) => void;
  selectCopilotProposal: (proposalId?: string) => void;
  setActiveAnalysisLayers: (layers: AnalysisLayerId[]) => void;
  setActiveMepLayers: (layers: MepLayerId[]) => void;
  setActiveLevel: (levelId: string) => void;
  setMetricsScope: (scope: PlanScopeKind) => void;
  setLevelTransferFloor: (levelId: string, isTransferFloor: boolean) => void;
  selectRoom: (roomId: string) => void;
  selectWall: (wallId: string) => void;
  selectOpening: (openingId: string) => void;
  clearSelection: () => void;
  updateRoom: (roomId: string, patch: Partial<Room>) => void;
  updateRoomGeometry: (roomId: string, patch: Partial<Room>) => void;
  applyLevelRoomsGeometry: (rooms: Room[]) => void;
  applyWallDragCommit: (input: WallDragCommitInput) => void;
  mergeSelectedWallWith: (otherWallId: string) => void;
  splitSelectedWallAt: (param: number) => void;
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
  refreshCopilotInsights: () => void;
  reviewCopilotInsights: () => void;
  recordDesignDecision: (input: {
    trigger: "user_instruction" | "ai_suggestion_accepted" | "manual_edit";
    description: string;
    affectedRoomIds?: string[];
    versionIdBefore: string;
    versionIdAfter: string;
  }) => void;
  generateMep: () => Promise<void>;
  openModelForVersion: (version: PlanVersion) => void;
  refineVersion: (version: PlanVersion) => void;
  returnToPlanGeneration: () => void;
  savePresentationSession: (
    versionId: string,
    patch: {
      deck?: PresentationDeck;
      templateId?: PresentationTemplateId;
      activeSlideIndex?: number;
    }
  ) => void;
  clearPresentationSession: (versionId: string) => void;
  setPresentationActiveSlide: (versionId: string, activeSlideIndex: number) => void;
  setPresentationTemplateId: (versionId: string, templateId: PresentationTemplateId) => void;
}

export type EvoProjectStoreData = Omit<
  EvoProjectStore,
  keyof EvoProjectStoreActions
>;

export type EvoProjectStoreActions = {
  [K in keyof EvoProjectStore as EvoProjectStore[K] extends (...args: never[]) => unknown ? K : never]: EvoProjectStore[K];
};
