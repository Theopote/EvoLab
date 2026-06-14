"use client";

import { BottomPanel } from "@/components/bottom-panel";
import { CopilotPanel } from "@/components/copilot-panel";
import { DiagramCanvas } from "@/components/diagrams/DiagramCanvas";
import { DiagramLayerList } from "@/components/diagrams/DiagramLayerList";
import { ExportPanel } from "@/components/export-panel";
import { FloorPlan } from "@/components/floor-plan";
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
  const store = useEvoProject();
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
  } = store;

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

            <Inspector />
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

  function Inspector() {
    return (
      <section className="mt-4 rounded border border-line bg-panel/90 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Inspector</h2>
          <span className="rounded border border-success/30 px-2 py-1 text-xs text-success">Live</span>
        </div>
        <dl className="space-y-3 text-sm">
          <Info label="Project type" value={project.projectType} />
          <Info label="Active scheme" value={activeVersion?.label ?? "None"} />
          <Info label="Rooms" value={String(activeVersion?.rooms.length ?? 0)} />
          <Info label="Area efficiency" value={String(activeVersion?.scores?.areaEfficiency ?? 0)} />
          <Info label="Flow score" value={String(activeVersion?.scores?.circulationScore ?? 0)} />
          <Info label="Daylight score" value={String(activeVersion?.scores?.daylightScore ?? 0)} />
          <Info label="MEP alignment" value={String(activeVersion?.scores?.mepAlignmentScore ?? 0)} />
          <Info label="MEP routes" value={String(activeVersion?.mep?.routes.length ?? 0)} />
          <Info label="MEP shafts" value={String(activeVersion?.mep?.shafts.length ?? 0)} />
          <Info label="Risk count" value={String(activeVersion?.scores?.riskCount ?? 0)} />
          <Info label="Gross area" value={`${quantities?.summary.grossArea ?? 0} sqm`} />
          <Info label="Wall area" value={`${quantities?.summary.wallArea ?? 0} sqm`} />
          <Info
            label="Compliance warnings"
            value={String(complianceItems.filter((item) => item.status === "warning").length)}
          />
        </dl>
      </section>
    );
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white/[0.03] p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate text-slate-100">{value}</dd>
    </div>
  );
}
