import { produce } from "immer";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { validateAndNormalizeProjectVersions } from "@/lib/schemas/store-boundary";
import { createDefaultScoringConfig, normalizeScoringConfig } from "@/lib/rules/scoring-config";
import {
  isBriefContextPhase,
  normalizeWorkflowPhase,
  normalizeWorkspaceTab,
  phaseForTab,
  resolvePhaseTab
} from "@/lib/workflow-navigation";
import { programFromBrief } from "@/lib/project-domain";
import { applyTypologyPackToDomain, briefFromTypologyPack } from "@/lib/typologies/domain";
import { createProjectBundle, type CreateProjectInput } from "@/lib/projects/create-project";
import type { TypologyPackId } from "@/lib/typology/types";
import { createEmptyIntakeRecord } from "@/lib/intake/project-intake-types";
import { relayoutPlanCommand, resolveRelayoutOutline } from "@/lib/store/commands/relayout-plan";
import {
  bumpGeometryRevision,
  clearSelectionDraft,
  commitNormalizedVersionDraft,
  getActiveVersion,
  refreshDerivedDraft,
  refreshDomainDraft,
  refreshScopedQuantitiesDraft,
  recordVersionChangeSet,
  rescoreProjectVersions,
  syncOutlineFromVersionDraft
} from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { ProjectSliceActions } from "@/lib/store/slice-types";
import type { StateCreator } from "zustand";

export const createProjectSlice: StateCreator<EvoProjectStore, [], [], ProjectSliceActions> = (set, get) => ({
  setActiveTab: (tab) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeTab = tab;

        if (tab === "Plan" || normalizeWorkspaceTab(tab) === "Plan") {
          if (!isBriefContextPhase(state.workflowPhase) && normalizeWorkflowPhase(state.workflowPhase) !== "scheme") {
            state.workflowPhase = "site";
          }
          return;
        }

        state.workflowPhase = phaseForTab(tab);
      })
    ),
  updateBrief: (brief) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.brief = brief;
        state.project.projectType = brief.projectType;
        refreshDomainDraft(state);
      })
    ),
  setProjectTypology: (typologyId: TypologyPackId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const brief = briefFromTypologyPack(typologyId, {
          floors: state.brief.floors,
          targetArea: state.brief.targetArea
        });

        state.project.projectType = typologyId;
        state.brief = brief;
        state.project.domain = {
          ...applyTypologyPackToDomain(state.project.domain, typologyId),
          program: programFromBrief(brief, state.activeVersion?.metadata?.topologyGraph)
        };
        refreshDomainDraft(state);
        rescoreProjectVersions(state);
        refreshDerivedDraft(state);
      })
    ),
  updateProjectIntake: (patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        const current = state.project.domain.intake ?? createEmptyIntakeRecord();
        state.project.domain.intake = {
          ...current,
          ...patch,
          updatedAt: new Date().toISOString()
        };
      })
    ),
  loadDemoProject: (typologyId: TypologyPackId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const bundle = createProjectBundle(
          {
            projectName: `EvoLab ${typologyId} Demo`,
            buildingTypeId: typologyId,
            startMode: "demo"
          },
          `evolab-demo-${typologyId}`
        );
        state.project = bundle.project;
        state.brief = bundle.brief;
        state.workflowPhase = bundle.workflowPhase;
        state.activeTab = bundle.activeTab;
        state.undoStack = [];
        state.redoStack = [];
        clearSelectionDraft(state);
        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  createNewProject: (input: CreateProjectInput) =>
    set(
      produce<EvoProjectStore>((state) => {
        const bundle = createProjectBundle(input);
        state.project = bundle.project;
        state.brief = bundle.brief;
        state.workflowPhase = bundle.workflowPhase;
        state.activeTab = bundle.activeTab;
        state.undoStack = [];
        state.redoStack = [];
        clearSelectionDraft(state);
        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  renameProject: (projectName: string) =>
    set(
      produce<EvoProjectStore>((state) => {
        const trimmed = projectName.trim();
        if (!trimmed) {
          return;
        }

        state.project.projectName = trimmed;
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
  updateFacadeEnvelope: (patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        const current = state.project.domain.facadeEnvelope;

        if (!current) {
          return;
        }

        state.project.domain.facadeEnvelope = {
          ...current,
          ...patch,
          userEdited: true
        };
      })
    ),
  updateFacadeZone: (zoneId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        const current = state.project.domain.facadeEnvelope;

        if (!current) {
          return;
        }

        state.project.domain.facadeEnvelope = {
          ...current,
          userEdited: true,
          zones: current.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone))
        };
      })
    ),
  updateFurnitureItem: (itemId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        const layout = state.project.domain.furnitureLayout;

        if (!layout) {
          return;
        }

        state.project.domain.furnitureLayout = {
          ...layout,
          items: layout.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
        };
      })
    ),
  updateStructuralSystem: (patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        const current = state.project.domain.structuralSystem;

        if (!current) {
          return;
        }

        state.project.domain.structuralSystem = {
          ...current,
          ...patch,
          userEdited: true
        };
      })
    ),
  resetDerivedEnvelopeSystems: () =>
    set(
      produce<EvoProjectStore>((state) => {
        if (state.project.domain.facadeEnvelope) {
          state.project.domain.facadeEnvelope.userEdited = false;
        }

        if (state.project.domain.structuralSystem) {
          state.project.domain.structuralSystem.userEdited = false;
        }

        refreshDomainDraft(state);
      })
    ),
  updateTopologyGraph: (graph) =>
    set(
      produce<EvoProjectStore>((state) => {
        const currentVersion = state.activeVersion;

        if (!currentVersion) {
          return;
        }

        commitNormalizedVersionDraft(
          state,
          normalizePlanVersion({
            ...currentVersion,
            metadata: {
              ...currentVersion.metadata,
              topologyGraph: graph
            }
          }),
          false,
          true,
          "Updated bubble diagram adjacency",
          "user"
        );
      })
    ),
  setWorkflowPhase: (phase) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.workflowPhase = normalizeWorkflowPhase(phase);
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

        state.compareVersionIds = [...state.compareVersionIds, versionId].slice(-3);
      })
    ),
  setCompareVersionIds: (versionIds) =>
    set(
      produce<EvoProjectStore>((state) => {
        const validIds = new Set(state.project.versions.map((version) => version.id));
        state.compareVersionIds = [...new Set(versionIds.filter((id) => validIds.has(id)))].slice(-3);
      })
    ),
  setCompareModeOpen: (open) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.compareModeOpen = open;
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
  setMetricsScope: (scope) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.metricsScope = scope;
        refreshScopedQuantitiesDraft(state);
      })
    ),
  setLevelTransferFloor: (levelId, isTransferFloor) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        const nextLevels = state.activeVersion.levels.map((level) =>
          level.id === levelId ? { ...level, isTransferFloor } : level
        );
        const nextVersion = normalizePlanVersion({
          ...state.activeVersion,
          levels: nextLevels
        });

        commitNormalizedVersionDraft(
          state,
          nextVersion,
          false,
          true,
          isTransferFloor ? `Marked ${levelId} as transfer floor` : `Cleared transfer floor on ${levelId}`
        );
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
  replaceVersions: (versions, projectType = get().brief.projectType) =>
    set(
      produce<EvoProjectStore>((state) => {
        const normalizedVersions = validateAndNormalizeProjectVersions(versions, "replaceVersions");

        state.project.projectType = projectType;
        state.project.versions = normalizedVersions;
        state.project.activeVersionId = normalizedVersions[0]?.id ?? state.project.activeVersionId;
        state.undoStack = [];
        state.redoStack = [];
        clearSelectionDraft(state);
        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  appendGeneratedVersions: (versions, projectType = get().brief.projectType) =>
    set(
      produce<EvoProjectStore>((state) => {
        const parentVersionId = state.project.activeVersionId || state.project.versions[0]?.id;
        const normalizedVersions = validateAndNormalizeProjectVersions(versions, "appendGeneratedVersions").map((version) => ({
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
      const version = await relayoutPlanCommand({
        version: activeVersion,
        outline,
        layoutOutline: resolveRelayoutOutline(outline, buildableEnvelope)
      });

      set(
        produce<EvoProjectStore>((state) => {
          commitNormalizedVersionDraft(
            state,
            normalizePlanVersion(version),
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
  }
});
