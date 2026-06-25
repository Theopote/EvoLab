"use client";

import { memo, useCallback } from "react";
import { DiagramCanvas } from "@/components/diagrams/DiagramCanvas";
import { DiagramLayerList } from "@/components/diagrams/DiagramLayerList";
import { ExportPanel } from "@/components/export-panel";
import { MassingPanel } from "@/components/massing-panel";
import { MepCanvas } from "@/components/mep/MepCanvas";
import { MepLayerList } from "@/components/mep/MepLayerList";
import { QuantityTable } from "@/components/quantity/QuantityTable";
import { DeliverPresentationView } from "@/components/presentation/DeliverPresentationView";
import { SchemeSplitViewport } from "@/components/workflow/SchemeSplitViewport";
import { ExplodeSlider } from "@/components/viewer-3d/ExplodeSlider";
import { IntakeWorkspace } from "@/components/workflow/IntakeWorkspace";
import { ProgramWorkspace } from "@/components/workflow/ProgramWorkspace";
import { ReviewWorkspace } from "@/components/workflow/ReviewWorkspace";
import { SiteWorkspace } from "@/components/workflow/SiteWorkspace";
import { StructureWorkspace } from "@/components/workflow/StructureWorkspace";
import { FacadeWorkspace } from "@/components/workflow/FacadeWorkspace";
import { FurnitureWorkspace } from "@/components/workflow/FurnitureWorkspace";
import { CompareWorkspace } from "@/components/workflow/CompareWorkspace";
import { PlanResultGrid } from "@/components/plan-editor/PlanResultGrid";
import { Scene } from "@/components/viewer-3d/Scene";
import type { ImportWizardResult } from "@/components/workflow/import/ImportWizard";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { useInteractionStore } from "@/lib/interaction-store";
import { useImportSessionStore } from "@/lib/import-session-store";
import {
  useAnalysisActions,
  useAnalysisState,
  useExportActions,
  useProjectActions,
  useProjectState,
  useReviewActions,
  useReviewState,
  useSelectionActions,
  useSiteActions,
  useSiteState
} from "@/lib/project-store";
import { tabForSchemeSubview } from "@/lib/workflow-phases";

export const WorkspaceMainViewport = memo(function WorkspaceMainViewport() {
  const {
    project,
    activeVersion,
    activeLevelId,
    brief,
    activeTab,
    workflowPhase,
    compareModeOpen,
    compareVersionIds,
    compareLevelId,
    outlineStale,
    isRelayouting,
    relayoutError,
    geometryRevision
  } = useProjectState((state) => ({
    project: state.project,
    activeVersion: state.activeVersion,
    activeLevelId: state.activeLevelId,
    brief: state.brief,
    activeTab: state.activeTab,
    workflowPhase: state.workflowPhase,
    compareModeOpen: state.compareModeOpen,
    compareVersionIds: state.compareVersionIds,
    compareLevelId: state.compareLevelId,
    outlineStale: state.outlineStale,
    isRelayouting: state.isRelayouting,
    relayoutError: state.relayoutError,
    geometryRevision: state.geometryRevision
  }));

  const { outline, outlineClosed, zoning } = useSiteState((state) => ({
    outline: state.outline,
    outlineClosed: state.outlineClosed,
    zoning: state.zoning
  }));

  const {
    quantities,
    scopedQuantities,
    metricsScope,
    activeSchedule,
    complianceItems,
    activeAnalysisLayers,
    activeMepLayers,
    isGeneratingMep,
    mepError
  } = useAnalysisState((state) => ({
    quantities: state.quantities,
    scopedQuantities: state.scopedQuantities,
    metricsScope: state.metricsScope,
    activeSchedule: state.activeSchedule,
    complianceItems: state.complianceItems,
    activeAnalysisLayers: state.activeAnalysisLayers,
    activeMepLayers: state.activeMepLayers,
    isGeneratingMep: state.isGeneratingMep,
    mepError: state.mepError
  }));

  const { selectedChangeSetId, selectedProposalId, lockedElementIds, copilotProposals, changeSets } =
    useReviewState((state) => ({
      selectedChangeSetId: state.selectedChangeSetId,
      selectedProposalId: state.selectedProposalId,
      lockedElementIds: state.lockedElementIds,
      copilotProposals: state.copilotProposals,
      changeSets: state.changeSets
    }));

  const {
    setActiveTab,
    setWorkflowPhase,
    setCompareModeOpen,
    setActiveLevel,
    updateBrief,
    appendGeneratedVersions,
    setActiveVersion,
    setCompareLevel,
    setMetricsScope,
    updateStructuralSystem,
    updateFacadeEnvelope,
    updateFacadeZone,
    relayoutActiveVersion
  } = useProjectActions();

  const { setOutline, setOutlineClosed } = useSiteActions();
  const { setActiveAnalysisLayers, setActiveMepLayers, generateMep } = useAnalysisActions();
  const {
    selectChangeSet,
    approveChangeSet,
    rejectChangeSet,
    selectCopilotProposal
  } = useReviewActions();
  const { toggleElementLock } = useSelectionActions();
  const { openModelForVersion, refineVersion } = useExportActions();

  const handleImportComplete = useCallback(
    (result: ImportWizardResult) => {
      const parent = activeVersion;
      const enrichedVersion = {
        ...result.version,
        metadata: {
          ...result.version.metadata,
          importSource: {
            fileName: result.file.fileName,
            sourceType: result.analysis.sourceType,
            importPath: result.analysis.importPath,
            confidence: result.analysis.confidence,
            warnings: result.analysis.warnings
          }
        }
      };

      appendGeneratedVersions([enrichedVersion]);

      useImportSessionStore.getState().setReference({
        versionId: enrichedVersion.id,
        fileName: result.file.fileName,
        sourceType: result.analysis.sourceType,
        previewUrl: result.referencePreviewUrl ?? result.file.previewUrl,
        opacity: result.file.sourceType === "image" ? 0.45 : 0.35
      });

      if (parent) {
        useCopilotTimelineStore.getState().addEntry({
          prompt: `Import plan from ${result.file.fileName}`,
          parentVersionId: parent.id,
          parentVersionLabel: parent.label,
          resultVersionId: enrichedVersion.id,
          resultVersionLabel: enrichedVersion.label
        });
      }

      if (result.openTrace) {
        useInteractionStore.getState().setActiveTool("trace");
      } else {
        useInteractionStore.getState().setActiveTool("select");
      }

      setWorkflowPhase("scheme");
      setActiveTab(tabForSchemeSubview("plan"));
    },
    [activeVersion, appendGeneratedVersions, setActiveTab, setWorkflowPhase]
  );

  if (compareModeOpen) {
    return (
      <CompareWorkspace
        versions={project.versions}
        activeVersionId={project.activeVersionId}
        compareVersionIds={compareVersionIds}
        compareLevelId={compareLevelId}
        domain={project.domain}
        program={project.domain.program}
        projectType={project.projectType}
        orientationDeg={project.domain.site.orientationDeg}
        onCompareLevelChange={setCompareLevel}
        onSelectVersion={setActiveVersion}
        onGenerateModel={openModelForVersion}
        onRefineVersion={refineVersion}
        onClose={() => setCompareModeOpen(false)}
        copilotProposals={copilotProposals}
        selectedProposalId={selectedProposalId}
        lockedElementIds={lockedElementIds}
      />
    );
  }

  if (activeTab === "Review") {
    return (
      <ReviewWorkspace
        changeSets={changeSets}
        copilotProposals={copilotProposals}
        versions={project.versions}
        selectedChangeSetId={selectedChangeSetId}
        lockedElementIds={lockedElementIds}
        onSelectChangeSet={selectChangeSet}
        onApproveChangeSet={approveChangeSet}
        onRejectChangeSet={rejectChangeSet}
        onToggleElementLock={toggleElementLock}
        selectedProposalId={selectedProposalId}
        onSelectProposal={selectCopilotProposal}
        onOpenCompare={() => setCompareModeOpen(true)}
      />
    );
  }

  if (workflowPhase === "import" || activeTab === "Import") {
    return (
      <IntakeWorkspace
        onImportComplete={handleImportComplete}
        onContinueToScheme={() => {
          setWorkflowPhase("scheme");
          setActiveTab(tabForSchemeSubview("plan"));
          useInteractionStore.getState().setActiveTool("trace");
        }}
      />
    );
  }

  if (workflowPhase === "program" || activeTab === "Program") {
    return (
      <ProgramWorkspace
        brief={brief}
        program={project.domain.program}
        outline={outline}
        outlineClosed={outlineClosed}
        zoning={zoning}
        versions={project.versions}
        activeVersionId={project.activeVersionId}
        activeVersion={activeVersion}
        onBriefChange={updateBrief}
        onGenerated={appendGeneratedVersions}
        onSelectVersion={setActiveVersion}
      />
    );
  }

  if (workflowPhase === "site" || activeTab === "Site") {
    return (
      <SiteWorkspace
        outline={outline}
        outlineClosed={outlineClosed}
        outlineStale={outlineStale}
        isRelayouting={isRelayouting}
        relayoutError={relayoutError}
        onOutlineChange={setOutline}
        onOutlineClosedChange={setOutlineClosed}
        onRelayout={() => void relayoutActiveVersion()}
      />
    );
  }

  if (activeTab === "Model") {
    return (
      <section className="grid min-h-full grid-rows-[auto_auto_minmax(560px,1fr)] gap-4">
        <div className="rounded border border-line bg-panel/90 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-white">3D Building Model</h1>
              <p className="mt-1 text-xs text-muted">
                Generated from activeVersion.rooms. Orbit, pan and zoom are enabled.
              </p>
            </div>
            <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">
              {activeVersion?.label ?? "No active version"}
            </span>
          </div>
        </div>
        <ExplodeSlider className="rounded border border-line bg-panel/90 px-3 py-2" />
        <Scene />
      </section>
    );
  }

  if (activeTab === "Massing") {
    return <MassingPanel activeVersion={activeVersion} onOpenModel={() => setActiveTab("Model")} />;
  }

  if (activeTab === "Structure") {
    return (
      <StructureWorkspace
        version={activeVersion}
        activeLevelId={activeLevelId}
        structuralSystem={project.domain.structuralSystem}
        storeyStack={project.domain.storeyStack}
        verticalCirculation={project.domain.verticalCirculation}
        onLevelChange={setActiveLevel}
        onUpdateStructuralSystem={updateStructuralSystem}
      />
    );
  }

  if (activeTab === "Facade") {
    return (
      <FacadeWorkspace
        version={activeVersion}
        activeLevelId={activeLevelId}
        facadeEnvelope={project.domain.facadeEnvelope}
        orientationDeg={project.domain.site.orientationDeg}
        onLevelChange={setActiveLevel}
        onUpdateFacadeEnvelope={updateFacadeEnvelope}
        onUpdateFacadeZone={updateFacadeZone}
      />
    );
  }

  if (activeTab === "Furniture") {
    return <FurnitureWorkspace layout={project.domain.furnitureLayout} activeVersion={activeVersion} />;
  }

  if (activeTab === "Analysis") {
    return (
      <section className="grid min-h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
        <DiagramLayerList
          activeLayers={activeAnalysisLayers}
          onChange={setActiveAnalysisLayers}
          projectType={project.projectType}
        />
        <DiagramCanvas
          activeLayers={activeAnalysisLayers}
          levelId={activeLevelId}
          projectType={project.projectType}
          version={activeVersion}
        />
      </section>
    );
  }

  if (activeTab === "Systems") {
    return (
      <section className="grid min-h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
        <div>
          <MepLayerList
            activeLayers={activeMepLayers}
            canGenerate={Boolean(activeVersion)}
            isGenerating={isGeneratingMep}
            onChange={setActiveMepLayers}
            onGenerate={generateMep}
          />
          {mepError ? (
            <div className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs leading-5 text-warning">
              {mepError}
            </div>
          ) : null}
        </div>
        <MepCanvas activeLayers={activeMepLayers} version={activeVersion} activeLevelId={activeLevelId} />
      </section>
    );
  }

  if (activeTab === "Quantity") {
    const displayQuantities = scopedQuantities ?? quantities;

    return displayQuantities ? (
      <QuantityTable
        activeLevelId={activeLevelId}
        activeSchedule={activeSchedule}
        includeSchedules={false}
        metricsScope={metricsScope}
        quantities={displayQuantities}
        version={activeVersion}
        onMetricsScopeChange={setMetricsScope}
      />
    ) : (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Select or generate a plan version to calculate quantities.
      </div>
    );
  }

  if (activeTab === "Presentation" || activeTab === "Sheets" || activeTab === "Render") {
    return (
      <DeliverPresentationView
        activeTab={activeTab}
        activeVersion={activeVersion}
        versions={project.versions}
        activeVersionId={project.activeVersionId}
        compareLevelId={compareLevelId}
        domain={project.domain}
        program={project.domain.program}
        projectType={project.projectType}
        orientationDeg={project.domain.site.orientationDeg}
        onCompareLevelChange={setCompareLevel}
        onSelectVersion={setActiveVersion}
        onGenerateModel={openModelForVersion}
        onRefineVersion={refineVersion}
      />
    );
  }

  if (activeTab === "Export") {
    return (
      <ExportPanel
        project={project}
        activeVersion={activeVersion}
        quantities={quantities}
        complianceItems={complianceItems}
      />
    );
  }

  return (
    <section className="grid min-h-full grid-rows-[minmax(560px,1fr)_minmax(280px,0.8fr)] gap-4">
      <SchemeSplitViewport
        activeVersion={activeVersion}
        activeLevelId={activeLevelId}
        geometryRevision={geometryRevision}
        onLevelChange={setActiveLevel}
      />
      <PlanResultGrid
        outline={outline}
        closed={outlineClosed}
        brief={brief}
        program={project.domain.program}
        zoning={zoning}
        versions={project.versions}
        activeVersionId={project.activeVersionId}
        onGenerated={appendGeneratedVersions}
        onSelectVersion={setActiveVersion}
      />
    </section>
  );
});
