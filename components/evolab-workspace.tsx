"use client";

import { Loader2, RefreshCcw } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { BottomPanel } from "@/components/bottom-panel";
import { CopilotConsole } from "@/components/copilot/CopilotConsole";
import { DiagramCanvas } from "@/components/diagrams/DiagramCanvas";
import { DiagramLayerList } from "@/components/diagrams/DiagramLayerList";
import { ExportPanel } from "@/components/export-panel";
import { FloorPlan } from "@/components/floor-plan";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { MassingPanel } from "@/components/massing-panel";
import { MepCanvas } from "@/components/mep/MepCanvas";
import { MepLayerList } from "@/components/mep/MepLayerList";
import { SiteContextPanel } from "@/components/site/SiteContextPanel";
import { BriefForm } from "@/components/plan-editor/BriefForm";
import { OutlineCanvas } from "@/components/plan-editor/OutlineCanvas";
import { PlanResultGrid } from "@/components/plan-editor/PlanResultGrid";
import { ComplianceChecklist } from "@/components/quantity/ComplianceChecklist";
import { QuantityTable } from "@/components/quantity/QuantityTable";
import { RenderPanel } from "@/components/render-panel";
import { TopNav } from "@/components/top-nav";
import { PresentationWorkspace } from "@/components/presentation/PresentationWorkspace";
import { VersionCompareGrid } from "@/components/version-compare/VersionCompareGrid";
import { PhaseSubNav } from "@/components/workflow/PhaseSubNav";
import { SchemeSplitViewport } from "@/components/workflow/SchemeSplitViewport";
import { ExplodeSlider } from "@/components/viewer-3d/ExplodeSlider";
import { VersionSplitCompare } from "@/components/workflow/VersionSplitCompare";
import { ViewportKpiHud } from "@/components/workflow/ViewportKpiHud";
import { WorkflowLeftSidebar } from "@/components/workflow/WorkflowLeftSidebar";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { Scene } from "@/components/viewer-3d/Scene";
import { tabForDeliverSubview } from "@/lib/workflow-phases";
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
    activeTab,
    workflowPhase,
    compareVersionIds,
    activeAnalysisLayers,
    activeMepLayers,
    isGeneratingMep,
    mepError,
    quantities,
    complianceItems,
    outlineStale,
    isRelayouting,
    relayoutError,
    compareLevelId,
    setActiveTab,
    setWorkflowPhase,
    toggleCompareVersion,
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
      activeTab: state.activeTab,
      workflowPhase: state.workflowPhase,
      compareVersionIds: state.compareVersionIds,
      activeAnalysisLayers: state.activeAnalysisLayers,
      activeMepLayers: state.activeMepLayers,
      isGeneratingMep: state.isGeneratingMep,
      mepError: state.mepError,
      quantities: state.quantities,
      complianceItems: state.complianceItems,
      outlineStale: state.outlineStale,
      isRelayouting: state.isRelayouting,
      relayoutError: state.relayoutError,
      compareLevelId: state.compareLevelId,
      setActiveTab: state.setActiveTab,
      setWorkflowPhase: state.setWorkflowPhase,
      toggleCompareVersion: state.toggleCompareVersion,
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
      generateMep: state.generateMep,
      openModelForVersion: state.openModelForVersion,
      refineVersion: state.refineVersion,
      returnToPlanGeneration: state.returnToPlanGeneration
    }))
  );

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <TopNav project={project} workflowPhase={workflowPhase} onPhaseChange={setWorkflowPhase} />
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
          />

          <section className="relative min-h-0 overflow-hidden">
            <ViewportKpiHud />
            <div className="cad-grid h-full overflow-auto p-4">
              <VersionSplitCompare
                versions={project.versions}
                compareVersionIds={compareVersionIds}
                compareLevelId={compareLevelId}
                onCompareLevelChange={setCompareLevel}
              />
              {renderMainViewport()}
            </div>
          </section>

          <aside className="min-h-0 overflow-auto border-l border-line bg-[#0d141d] p-4">
            {workflowPhase === "brief_site" && activeTab === "Plan" ? (
              <div className="space-y-4">
                <SiteContextPanel />
                <BriefForm value={brief} onChange={updateBrief} />
              </div>
            ) : null}

            <div className={workflowPhase === "brief_site" && activeTab === "Plan" ? "mt-4" : ""}>
              <InspectorPanel />
            </div>
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
    </main>
  );

  function renderMainViewport() {
    if (activeTab === "Model") {
      return <ModelWorkspace />;
    }

    if (activeTab === "Massing") {
      return <MassingPanel activeVersion={activeVersion} onOpenModel={() => setActiveTab("Model")} />;
    }

    if (activeTab === "Analysis") {
      return (
        <section className="grid min-h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
          <DiagramLayerList activeLayers={activeAnalysisLayers} onChange={setActiveAnalysisLayers} />
          <DiagramCanvas activeLayers={activeAnalysisLayers} version={activeVersion} levelId={activeLevelId} />
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

    if (activeTab === "Quantity") {
      return (
        <section className="grid min-h-full grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-4">
          {quantities ? (
            <QuantityTable quantities={quantities} />
          ) : (
            <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
              Select or generate a plan version to calculate quantities.
            </div>
          )}
          <ComplianceChecklist items={complianceItems} />
        </section>
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
            onCompareLevelChange={setCompareLevel}
            onSelectVersion={setActiveVersion}
            onGenerateModel={openModelForVersion}
            onRefineVersion={refineVersion}
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

    return <PlanWorkspace />;
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
      updateActiveVersion(version);
      return;
    }

    handleCopilotRevision(version, prompt, activeVersion);
  }

  function handleCopilotRevision(
    version: Parameters<typeof updateActiveVersion>[0],
    prompt: string,
    parentVersion: NonNullable<typeof activeVersion>
  ) {
    updateActiveVersion(version);
    useCopilotTimelineStore.getState().addEntry({
      prompt,
      parentVersionId: parentVersion.id,
      parentVersionLabel: parentVersion.label,
      resultVersionId: version.id,
      resultVersionLabel: version.label
    });
  }

  function PlanWorkspace() {
    if (workflowPhase === "scheme") {
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
            zoning={zoning}
            versions={project.versions}
            activeVersionId={project.activeVersionId}
            onGenerated={appendGeneratedVersions}
            onSelectVersion={setActiveVersion}
          />
        </section>
      );
    }

    return (
      <section className="grid min-h-full grid-rows-[minmax(360px,0.9fr)_minmax(320px,1fr)] gap-4">
        <div className="grid min-h-0 grid-cols-[360px_minmax(0,1fr)] gap-4">
          <OutlineCanvas
            points={outline}
            closed={outlineClosed}
            onChange={setOutline}
            onClosedChange={setOutlineClosed}
          />
          <section className="rounded border border-line bg-panel/90 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h1 className="text-base font-semibold text-white">Plan Workspace</h1>
                <p className="mt-1 text-xs text-muted">
                  Active version is the shared data source for plan, model, analysis, MEP and quantity.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {outlineStale && activeVersion ? (
                  <button
                    className="flex h-8 items-center gap-2 rounded border border-warning/50 bg-warning/10 px-2 text-xs text-warning hover:border-warning"
                    type="button"
                    onClick={() => void relayoutActiveVersion()}
                    disabled={isRelayouting}
                  >
                    {isRelayouting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                    Relayout active plan
                  </button>
                ) : null}
                {activeVersion?.levels.length ? (
                  <select
                    className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
                    value={activeLevelId ?? activeVersion.levels[0]?.id}
                    onChange={(event) => setActiveLevel(event.target.value)}
                  >
                    {activeVersion.levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <span className="rounded border border-success/30 px-2 py-1 text-xs text-success">
                  {outlineClosed ? "Outline closed" : "Outline open"}
                </span>
                {outlineStale ? (
                  <span className="rounded border border-warning/40 px-2 py-1 text-xs text-warning">Outline changed</span>
                ) : null}
              </div>
            </div>
            {relayoutError ? (
              <div className="mb-3 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{relayoutError}</div>
            ) : null}
            <FloorPlan
              levelId={activeLevelId}
              version={activeVersion}
              onInpaintRevision={handleInpaintRevision}
            />
          </section>
        </div>

        <PlanResultGrid
          outline={outline}
          closed={outlineClosed}
          brief={brief}
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
