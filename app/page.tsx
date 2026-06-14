"use client";

import { Boxes, DraftingCompass, MousePointer2, Upload, Waypoints } from "lucide-react";
import { useMemo, useState } from "react";
import { BottomPanel } from "@/components/bottom-panel";
import { CopilotPanel } from "@/components/copilot-panel";
import { DiagramCanvas } from "@/components/diagrams/DiagramCanvas";
import { DiagramLayerList } from "@/components/diagrams/DiagramLayerList";
import { FloorPlan } from "@/components/floor-plan";
import { MepCanvas } from "@/components/mep/MepCanvas";
import { MepLayerList, type MepLayerId } from "@/components/mep/MepLayerList";
import { BriefForm, type PlanBrief } from "@/components/plan-editor/BriefForm";
import { OutlineCanvas } from "@/components/plan-editor/OutlineCanvas";
import { PlanResultGrid } from "@/components/plan-editor/PlanResultGrid";
import { ComplianceChecklist } from "@/components/quantity/ComplianceChecklist";
import { QuantityTable } from "@/components/quantity/QuantityTable";
import { TopNav, type WorkspaceTab } from "@/components/top-nav";
import { VersionCompareGrid } from "@/components/version-compare/VersionCompareGrid";
import { Scene } from "@/components/viewer-3d/Scene";
import { initialProjectData } from "@/lib/evolab-data";
import { calculateQuantities, checkCompliance } from "@/lib/quantity-engine";
import type { AnalysisLayerId, MepLayout, PlanVersion, Point, ProjectData } from "@/lib/project-types";

const tools = [
  { label: "Select", icon: MousePointer2 },
  { label: "Outline", icon: DraftingCompass },
  { label: "Upload", icon: Upload },
  { label: "Flow", icon: Waypoints },
  { label: "Model", icon: Boxes }
];

const defaultOutline: Point[] = [
  [0, 0],
  [72, 0],
  [72, 42],
  [0, 42]
];

const defaultBrief: PlanBrief = {
  projectType: initialProjectData.projectType,
  description: "Outpatient clinic with clear public waiting, clinical rooms, staff work area, compact core, shafts aligned with equipment room, and strong south daylight.",
  floors: 3,
  targetArea: 2400,
  corePreference: "north service edge",
  orientationPreference: "south daylight"
};

export default function Home() {
  const [project, setProject] = useState<ProjectData>(initialProjectData);
  const [outline, setOutline] = useState<Point[]>(defaultOutline);
  const [outlineClosed, setOutlineClosed] = useState(true);
  const [brief, setBrief] = useState<PlanBrief>(defaultBrief);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Plan");
  const [activeAnalysisLayers, setActiveAnalysisLayers] = useState<AnalysisLayerId[]>([
    "function_zones",
    "patient_flow",
    "egress_path",
    "daylight"
  ]);
  const [activeMepLayers, setActiveMepLayers] = useState<MepLayerId[]>([
    "hvac",
    "plumbing_supply",
    "plumbing_drain",
    "electrical",
    "shafts",
    "equipment_rooms"
  ]);
  const [isGeneratingMep, setIsGeneratingMep] = useState(false);
  const [mepError, setMepError] = useState<string | null>(null);

  const activeVersion = useMemo(
    () => project.versions.find((version) => version.id === project.activeVersionId),
    [project.activeVersionId, project.versions]
  );
  const quantities = useMemo(
    () => (activeVersion ? calculateQuantities(activeVersion) : undefined),
    [activeVersion]
  );
  const complianceItems = useMemo(
    () => (activeVersion ? checkCompliance(activeVersion) : []),
    [activeVersion]
  );

  function handleGenerated(versions: PlanVersion[]) {
    setProject((current) => ({
      ...current,
      projectType: brief.projectType,
      versions,
      activeVersionId: versions[0]?.id ?? current.activeVersionId
    }));
  }

  function handleSelectVersion(version: PlanVersion) {
    setProject((current) => {
      const exists = current.versions.some((item) => item.id === version.id);

      return {
        ...current,
        versions: exists ? current.versions : [...current.versions, version],
        activeVersionId: version.id
      };
    });
  }

  function handleVersionUpdated(version: PlanVersion) {
    setProject((current) => {
      const nextVersions = current.versions.some((item) => item.id === version.id)
        ? current.versions.map((item) => (item.id === version.id ? version : item))
        : [...current.versions, version];

      return {
        ...current,
        versions: nextVersions,
        activeVersionId: version.id
      };
    });
  }

  function handleCopilotRegenerate() {
    setActiveTab("Plan");
  }

  function handleGenerateModel(version: PlanVersion) {
    handleSelectVersion(version);
    setActiveTab("Model");
  }

  function handleRefineVersion(version: PlanVersion) {
    handleSelectVersion(version);
    setActiveTab("Plan");
  }

  async function handleGenerateMep() {
    if (!activeVersion || isGeneratingMep) {
      return;
    }

    setIsGeneratingMep(true);
    setMepError(null);

    try {
      const response = await fetch("/api/generate-mep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: activeVersion })
      });

      if (!response.ok) {
        throw new Error(`generate-mep failed with ${response.status}`);
      }

      const data = (await response.json()) as { mep?: MepLayout; warning?: string };

      if (!data.mep?.routes) {
        throw new Error("generate-mep did not return a MepLayout.");
      }

      handleVersionUpdated({
        ...activeVersion,
        mep: data.mep,
        scores: activeVersion.scores
          ? {
              ...activeVersion.scores,
              mepAlignmentScore: Math.min(100, activeVersion.scores.mepAlignmentScore + 4)
            }
          : activeVersion.scores
      });

      if (data.warning) {
        setMepError(`Fallback MEP generated: ${data.warning}`);
      }
    } catch (error) {
      setMepError(error instanceof Error ? error.message : "Failed to generate MEP.");
    } finally {
      setIsGeneratingMep(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <TopNav project={project} activeTab={activeTab} onTabChange={setActiveTab} />
      <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_218px] overflow-hidden">
        <div className="grid min-h-0 grid-cols-[72px_minmax(0,1fr)_380px] overflow-hidden">
          <aside className="border-r border-line bg-[#0a0f15] p-3">
            <div className="flex h-full flex-col items-center gap-2">
              {tools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <button
                    className={`grid h-11 w-11 place-items-center rounded border ${
                      index === 1
                        ? "border-accent/60 bg-accent/12 text-accent"
                        : "border-line text-muted hover:border-accent/50 hover:text-accent"
                    }`}
                    key={tool.label}
                    type="button"
                    title={tool.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="cad-grid min-h-0 overflow-auto p-4">
          {activeTab === "Model" ? (
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
          ) : activeTab === "Analysis" ? (
            <section className="grid min-h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
              <DiagramLayerList
                activeLayers={activeAnalysisLayers}
                onChange={setActiveAnalysisLayers}
              />
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
                  onGenerate={handleGenerateMep}
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
          ) : activeTab === "Sheets" ? (
            <VersionCompareGrid
              versions={project.versions}
              activeVersionId={project.activeVersionId}
              onSelectVersion={handleSelectVersion}
              onGenerateModel={handleGenerateModel}
              onRefineVersion={handleRefineVersion}
            />
          ) : (
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
                onGenerated={handleGenerated}
                onSelectVersion={handleSelectVersion}
              />
            </section>
          )}
          </section>

          <aside className="min-h-0 overflow-auto border-l border-line bg-[#0d141d] p-4">
          <CopilotPanel
            activeVersion={activeVersion}
            activeTab={activeTab}
            outline={outline}
            projectType={project.projectType}
            onVersionUpdated={handleVersionUpdated}
            onTabChange={setActiveTab}
            onRegeneratePlan={handleCopilotRegenerate}
          />

          {activeTab === "Plan" ? (
            <div className="mt-4">
              <BriefForm value={brief} onChange={setBrief} />
            </div>
          ) : null}

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
          </aside>
        </div>
        <BottomPanel
          project={project}
          activeVersion={activeVersion}
          quantities={quantities}
          complianceItems={complianceItems}
          onSelectVersion={handleSelectVersion}
        />
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white/[0.03] p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate text-slate-100">{value}</dd>
    </div>
  );
}
