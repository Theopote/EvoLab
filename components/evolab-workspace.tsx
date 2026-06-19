"use client";

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { BottomPanel } from "@/components/bottom-panel";
import { CopilotConsole } from "@/components/copilot/CopilotConsole";
import { DiagramCanvas } from "@/components/diagrams/DiagramCanvas";
import { DiagramLayerList } from "@/components/diagrams/DiagramLayerList";
import { ExportPanel } from "@/components/export-panel";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { MassingPanel } from "@/components/massing-panel";
import { MepCanvas } from "@/components/mep/MepCanvas";
import { MepLayerList } from "@/components/mep/MepLayerList";
import { ComplianceChecklist } from "@/components/quantity/ComplianceChecklist";
import { ProgramCompliancePanel } from "@/components/quantity/ProgramCompliancePanel";
import { QuantityTable } from "@/components/quantity/QuantityTable";
import { RenderPanel } from "@/components/render-panel";
import { TopNav } from "@/components/top-nav";
import { PresentationWorkspace } from "@/components/presentation/PresentationWorkspace";
import { VersionCompareGrid } from "@/components/version-compare/VersionCompareGrid";
import { ReportEditor } from "@/components/report-editor/ReportEditor";
import { PhaseSubNav } from "@/components/workflow/PhaseSubNav";
import { SchemeSplitViewport } from "@/components/workflow/SchemeSplitViewport";
import { ExplodeSlider } from "@/components/viewer-3d/ExplodeSlider";
import { VersionSplitCompare } from "@/components/workflow/VersionSplitCompare";
import { ViewportKpiHud } from "@/components/workflow/ViewportKpiHud";
import { WorkflowLeftSidebar } from "@/components/workflow/WorkflowLeftSidebar";
import { IntakeWorkspace } from "@/components/workflow/IntakeWorkspace";
import { ProgramWorkspace } from "@/components/workflow/ProgramWorkspace";
import { ReviewWorkspace } from "@/components/workflow/ReviewWorkspace";
import { ScheduleWorkspace } from "@/components/workflow/ScheduleWorkspace";
import { SiteWorkspace } from "@/components/workflow/SiteWorkspace";
import { StructureWorkspace } from "@/components/workflow/StructureWorkspace";
import { FacadeWorkspace } from "@/components/workflow/FacadeWorkspace";
import { CompareWorkspace } from "@/components/workflow/CompareWorkspace";
import { PlanResultGrid } from "@/components/plan-editor/PlanResultGrid";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { Scene } from "@/components/viewer-3d/Scene";
import { tabForDeliverSubview, tabForSchemeSubview } from "@/lib/workflow-phases";
import { useEvoProject } from "@/lib/project-store";

export function EvoLabWorkspace() {
  const {
    project,
    activeVersion,
    activeLevelId,
    outline,
    outlineClosed,
    brief,
    zoning,
    siteContext,
    buildableEnvelope,
    environmentSurrogate,
    activeTab,
    workflowPhase,
    briefSiteSubview,
    quantifySubview,
    compareVersionIds,
    compareModeOpen,
    activeAnalysisLayers,
    activeMepLayers,
    isGeneratingMep,
    mepError,
    quantities,
    activeSchedule,
    complianceItems,
    outlineStale,
    isRelayouting,
    relayoutError,
    compareLevelId,
    selectedChangeSetId,
    setActiveTab,
    setWorkflowPhase,
    toggleCompareVersion,
    setCompareModeOpen,
    setActiveLevel,
    setOutline,
    setOutlineClosed,
    updateBrief,
    setActiveAnalysisLayers,
    setActiveMepLayers,
    appendGeneratedVersions,
    setActiveVersion,
    updateActiveVersion,
    relayoutActiveVersion,
    setCompareLevel,
    selectChangeSet,
    approveChangeSet,
    rejectChangeSet,
    toggleElementLock,
    generateMep,
    openModelForVersion,
    refineVersion,
    returnToPlanGeneration
  } = useEvoProject(
    useShallow((state) => ({
      project: state.project,
      activeVersion: state.activeVersion,
      activeLevelId: state.activeLevelId,
      outline: state.outline,
      outlineClosed: state.outlineClosed,
      brief: state.brief,
      zoning: state.zoning,
      siteContext: state.siteContext,
      buildableEnvelope: state.buildableEnvelope,
      environmentSurrogate: state.environmentSurrogate,
      activeTab: state.activeTab,
      workflowPhase: state.workflowPhase,
      briefSiteSubview: state.briefSiteSubview,
      quantifySubview: state.quantifySubview,
      compareVersionIds: state.compareVersionIds,
      compareModeOpen: state.compareModeOpen,
      activeAnalysisLayers: state.activeAnalysisLayers,
      activeMepLayers: state.activeMepLayers,
      isGeneratingMep: state.isGeneratingMep,
      mepError: state.mepError,
      quantities: state.quantities,
      activeSchedule: state.activeSchedule,
      complianceItems: state.complianceItems,
      outlineStale: state.outlineStale,
      isRelayouting: state.isRelayouting,
      relayoutError: state.relayoutError,
      compareLevelId: state.compareLevelId,
      selectedChangeSetId: state.selectedChangeSetId,
      setActiveTab: state.setActiveTab,
      setWorkflowPhase: state.setWorkflowPhase,
      toggleCompareVersion: state.toggleCompareVersion,
      setCompareModeOpen: state.setCompareModeOpen,
      setActiveLevel: state.setActiveLevel,
      setOutline: state.setOutline,
      setOutlineClosed: state.setOutlineClosed,
      updateBrief: state.updateBrief,
      setActiveAnalysisLayers: state.setActiveAnalysisLayers,
      setActiveMepLayers: state.setActiveMepLayers,
      appendGeneratedVersions: state.appendGeneratedVersions,
      setActiveVersion: state.setActiveVersion,
      updateActiveVersion: state.updateActiveVersion,
      relayoutActiveVersion: state.relayoutActiveVersion,
      setCompareLevel: state.setCompareLevel,
      selectChangeSet: state.selectChangeSet,
      approveChangeSet: state.approveChangeSet,
      rejectChangeSet: state.rejectChangeSet,
      toggleElementLock: state.toggleElementLock,
      generateMep: state.generateMep,
      openModelForVersion: state.openModelForVersion,
      refineVersion: state.refineVersion,
      returnToPlanGeneration: state.returnToPlanGeneration
    }))
  );
  const [reportEditorOpen, setReportEditorOpen] = useState(false);

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <TopNav
        project={project}
        workflowPhase={workflowPhase}
        onPhaseChange={setWorkflowPhase}
        onOpenReviews={() => setWorkflowPhase("review")}
      />
      <PhaseSubNav phase={workflowPhase} activeTab={activeTab} onTabChange={setActiveTab} />
      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_218px] overflow-hidden">
        <div className="grid min-h-0 grid-cols-[260px_minmax(0,1fr)_300px] overflow-hidden">
          <WorkflowLeftSidebar
            phase={workflowPhase}
            versions={project.versions}
            activeVersionId={project.activeVersionId}
            compareVersionIds={compareVersionIds}
            onSelectVersion={setActiveVersion}
            onToggleCompare={toggleCompareVersion}
            onOpenSheets={() => {
              setWorkflowPhase("deliver");
              setActiveTab(tabForDeliverSubview("sheets"));
            }}
            onOpenReportEditor={() => setReportEditorOpen(true)}
          />

          <section className="relative min-h-0 overflow-hidden">
            <ViewportKpiHud />
            <div className="cad-grid h-full overflow-auto p-4">
              {!compareModeOpen ? (
                <VersionSplitCompare
                  versions={project.versions}
                  compareVersionIds={compareVersionIds}
                  compareLevelId={compareLevelId}
                  onCompareLevelChange={setCompareLevel}
                />
              ) : null}
              {renderMainViewport()}
            </div>
          </section>

          <aside className="min-h-0 overflow-auto border-l border-line bg-[#0d141d] p-4">
            <InspectorPanel />
          </aside>
        </div>
        <CopilotConsole
          projectVersions={project.versions}
          activeVersion={activeVersion}
          activeTab={activeTab}
          outline={outline}
          projectType={project.projectType}
          onCopilotRevision={handleCopilotRevision}
          onAnalyzedVersion={handleAnalyzedVersion}
          onSelectVersion={setActiveVersion}
          onTabChange={setActiveTab}
          onRegeneratePlan={returnToPlanGeneration}
        />
        <BottomPanel
          project={project}
          activeVersion={activeVersion}
          quantities={quantities}
          complianceItems={complianceItems}
          onSelectVersion={setActiveVersion}
        />
      </section>
      {reportEditorOpen && activeVersion ? (
        <ReportEditor
          project={project}
          version={activeVersion}
          brief={brief}
          siteContext={siteContext}
          envelope={buildableEnvelope}
          environmentSurrogate={environmentSurrogate}
          outline={outline}
          onClose={() => setReportEditorOpen(false)}
        />
      ) : null}
    </main>
  );

  function renderMainViewport() {
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
          onHybridAccepted={handleHybridAccepted}
          onClose={() => setCompareModeOpen(false)}
        />
      );
    }

    if (workflowPhase === "review") {
      return (
        <ReviewWorkspace
          changeSets={project.domain.changeSets}
          copilotProposals={project.domain.copilotProposals}
          versions={project.versions}
          selectedChangeSetId={selectedChangeSetId}
          lockedElementIds={project.domain.lockedElementIds}
          onSelectChangeSet={selectChangeSet}
          onApproveChangeSet={approveChangeSet}
          onRejectChangeSet={rejectChangeSet}
          onToggleElementLock={toggleElementLock}
        />
      );
    }

    if (workflowPhase === "brief_site") {
      if (briefSiteSubview === "program") {
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

      if (briefSiteSubview === "intake") {
        return (
          <IntakeWorkspace
            onContinueToScheme={() => {
              setWorkflowPhase("scheme");
              setActiveTab(tabForSchemeSubview("plan"));
            }}
          />
        );
      }

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
      return <ModelWorkspace />;
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
          onInpaintRevision={handleInpaintRevision}
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
        />
      );
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
          <MepCanvas activeLayers={activeMepLayers} version={activeVersion} />
        </section>
      );
    }

    if (activeTab === "Quantity" && workflowPhase === "quantify") {
      if (quantifySubview === "schedules") {
        return <ScheduleWorkspace activeSchedule={activeSchedule} />;
      }

      if (quantifySubview === "compliance") {
        return (
          <section className="grid min-h-full grid-cols-[minmax(0,1fr)_minmax(380px,0.85fr)] gap-4">
            <ProgramCompliancePanel program={project.domain.program} activeVersion={activeVersion} />
            <ComplianceChecklist
              items={complianceItems}
              activeVersion={activeVersion}
              projectType={project.projectType}
              scoringConfig={project.domain.scoringConfig}
              onApplyRevision={handleInpaintRevision}
            />
          </section>
        );
      }

      return quantities ? (
        <QuantityTable quantities={quantities} activeSchedule={activeSchedule} includeSchedules={false} />
      ) : (
        <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
          Select or generate a plan version to calculate quantities.
        </div>
      );
    }

    if (activeTab === "Render") {
      return <RenderPanel activeVersion={activeVersion} />;
    }

    if (activeTab === "Sheets") {
      return (
        <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
          <PresentationWorkspace />
          <VersionCompareGrid
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
            onHybridAccepted={handleHybridAccepted}
          />
        </section>
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

    return <SchemeWorkspace />;
  }

  function ModelWorkspace() {
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

  function handleAnalyzedVersion(
    version: Parameters<typeof appendGeneratedVersions>[0][number],
    source: { fileName: string; prompt?: string }
  ) {
    const parent = activeVersion;
    appendGeneratedVersions([version]);

    if (parent) {
      useCopilotTimelineStore.getState().addEntry({
        prompt: source.prompt ?? `Recognize plan from ${source.fileName}`,
        parentVersionId: parent.id,
        parentVersionLabel: parent.label,
        resultVersionId: version.id,
        resultVersionLabel: version.label
      });
    }
  }

  function handleInpaintRevision(
    version: Parameters<typeof updateActiveVersion>[0],
    prompt: string
  ) {
    if (!activeVersion) {
      updateActiveVersion(version, { summary: prompt, source: "ai" });
      return;
    }

    handleCopilotRevision(version, prompt, activeVersion);
  }

  function handleCopilotRevision(
    version: Parameters<typeof updateActiveVersion>[0],
    prompt: string,
    parentVersion: NonNullable<typeof activeVersion>
  ) {
    updateActiveVersion(version, { summary: prompt, source: "ai" });
    useCopilotTimelineStore.getState().addEntry({
      prompt,
      parentVersionId: parentVersion.id,
      parentVersionLabel: parentVersion.label,
      resultVersionId: version.id,
      resultVersionLabel: version.label
    });
  }

  function handleHybridAccepted(version: Parameters<typeof updateActiveVersion>[0], summary: string) {
    updateActiveVersion(version, { summary, source: "ai" });

    if (activeVersion) {
      useCopilotTimelineStore.getState().addEntry({
        prompt: summary,
        parentVersionId: activeVersion.id,
        parentVersionLabel: activeVersion.label,
        resultVersionId: version.id,
        resultVersionLabel: version.label
      });
    }
  }

  function SchemeWorkspace() {
    return (
      <section className="grid min-h-full grid-rows-[minmax(560px,1fr)_minmax(280px,0.8fr)] gap-4">
        <SchemeSplitViewport
          activeVersion={activeVersion}
          activeLevelId={activeLevelId}
          onLevelChange={setActiveLevel}
          onInpaintRevision={handleInpaintRevision}
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
  }
}
