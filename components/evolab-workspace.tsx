"use client";

import { useShallow } from "zustand/react/shallow";
import { BottomPanel } from "@/components/bottom-panel";
import { CopilotPanel } from "@/components/copilot-panel";
import { DiagramCanvas } from "@/components/diagrams/DiagramCanvas";
import { DiagramLayerList } from "@/components/diagrams/DiagramLayerList";
import { ExportPanel } from "@/components/export-panel";
import { FloorPlan } from "@/components/floor-plan";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { MassingPanel } from "@/components/massing-panel";
import { MepCanvas } from "@/components/mep/MepCanvas";
import { MepLayerList } from "@/components/mep/MepLayerList";
import { BriefForm } from "@/components/plan-editor/BriefForm";
import { OutlineCanvas } from "@/components/plan-editor/OutlineCanvas";
import { PlanResultGrid } from "@/components/plan-editor/PlanResultGrid";
import { ComplianceChecklist } from "@/components/quantity/ComplianceChecklist";
import { QuantityTable } from "@/components/quantity/QuantityTable";
import { RenderPanel } from "@/components/render-panel";
import { ToolPalette } from "@/components/tool-palette";
import { TopNav } from "@/components/top-nav";
import { VersionCompareGrid } from "@/components/version-compare/VersionCompareGrid";
import { Scene } from "@/components/viewer-3d/Scene";
import { useEvoProject } from "@/lib/project-store";

export function EvoLabWorkspace() {
  const {
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
    updateBrief,
    setActiveAnalysisLayers,
    setActiveMepLayers,
    replaceVersions,
    setActiveVersion,
    updateActiveVersion,
    generateMep,
    openModelForVersion,
    refineVersion,
    returnToPlanGeneration
  } = useEvoProject(
    useShallow((state) => ({
      project: state.project,
      activeVersion: state.activeVersion,
      outline: state.outline,
      outlineClosed: state.outlineClosed,
      brief: state.brief,
      activeTab: state.activeTab,
      activeAnalysisLayers: state.activeAnalysisLayers,
      activeMepLayers: state.activeMepLayers,
      isGeneratingMep: state.isGeneratingMep,
      mepError: state.mepError,
      quantities: state.quantities,
      complianceItems: state.complianceItems,
      setActiveTab: state.setActiveTab,
      setOutline: state.setOutline,
      setOutlineClosed: state.setOutlineClosed,
      updateBrief: state.updateBrief,
      setActiveAnalysisLayers: state.setActiveAnalysisLayers,
      setActiveMepLayers: state.setActiveMepLayers,
      replaceVersions: state.replaceVersions,
      setActiveVersion: state.setActiveVersion,
      updateActiveVersion: state.updateActiveVersion,
      generateMep: state.generateMep,
      openModelForVersion: state.openModelForVersion,
      refineVersion: state.refineVersion,
      returnToPlanGeneration: state.returnToPlanGeneration
    }))
  );

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <TopNav project={project} activeTab={activeTab} onTabChange={setActiveTab} />
      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_218px] overflow-hidden">
        <div className="grid min-h-0 grid-cols-[72px_minmax(0,1fr)_380px] overflow-hidden">
          <ToolPalette activeTab={activeTab} onTabChange={setActiveTab} />

          <section className="cad-grid min-h-0 overflow-auto p-4">
            {activeTab === "Model" ? (
              <ModelWorkspace />
            ) : activeTab === "Massing" ? (
              <MassingPanel activeVersion={activeVersion} onOpenModel={() => setActiveTab("Model")} />
            ) : activeTab === "Analysis" ? (
              <section className="grid min-h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
                <DiagramLayerList activeLayers={activeAnalysisLayers} onChange={setActiveAnalysisLayers} />
                <DiagramCanvas activeLayers={activeAnalysisLayers} version={activeVersion} />
              </section>
            ) : activeTab === "Systems" ? (
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
            ) : activeTab === "Quantity" ? (
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
            ) : activeTab === "Render" ? (
              <RenderPanel activeVersion={activeVersion} />
            ) : activeTab === "Sheets" ? (
              <VersionCompareGrid
                versions={project.versions}
                activeVersionId={project.activeVersionId}
                onSelectVersion={setActiveVersion}
                onGenerateModel={openModelForVersion}
                onRefineVersion={refineVersion}
              />
            ) : activeTab === "Export" ? (
              <ExportPanel
                project={project}
                activeVersion={activeVersion}
                quantities={quantities}
                complianceItems={complianceItems}
              />
            ) : (
              <PlanWorkspace />
            )}
          </section>

          <aside className="min-h-0 overflow-auto border-l border-line bg-[#0d141d] p-4">
            <CopilotPanel
              activeVersion={activeVersion}
              activeTab={activeTab}
              outline={outline}
              projectType={project.projectType}
              onVersionUpdated={updateActiveVersion}
              onTabChange={setActiveTab}
              onRegeneratePlan={returnToPlanGeneration}
            />

            {activeTab === "Plan" ? (
              <div className="mt-4">
                <BriefForm value={brief} onChange={updateBrief} />
              </div>
            ) : null}

            <div className="mt-4">
              <InspectorPanel />
            </div>
          </aside>
        </div>
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

  function ModelWorkspace() {
    return (
      <section className="grid min-h-full grid-rows-[auto_minmax(560px,1fr)] gap-4">
        <div className="rounded border border-line bg-panel/90 p-3">
          <div className="flex items-center justify-between">
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
        <Scene version={activeVersion} />
      </section>
    );
  }

  function PlanWorkspace() {
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
              <span className="rounded border border-success/30 px-2 py-1 text-xs text-success">
                {outlineClosed ? "Outline closed" : "Outline open"}
              </span>
            </div>
            <FloorPlan version={activeVersion} />
          </section>
        </div>

        <PlanResultGrid
          outline={outline}
          closed={outlineClosed}
          brief={brief}
          versions={project.versions}
          activeVersionId={project.activeVersionId}
          onGenerated={replaceVersions}
          onSelectVersion={setActiveVersion}
        />
      </section>
    );
  }
}
