"use client";

import { Boxes, DraftingCompass, MousePointer2, Upload, Waypoints } from "lucide-react";
import { useMemo, useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import { BriefForm, type PlanBrief } from "@/components/plan-editor/BriefForm";
import { OutlineCanvas } from "@/components/plan-editor/OutlineCanvas";
import { PlanResultGrid } from "@/components/plan-editor/PlanResultGrid";
import { TopNav } from "@/components/top-nav";
import { initialProjectData } from "@/lib/evolab-data";
import type { PlanVersion, Point, ProjectData } from "@/lib/project-types";

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

  const activeVersion = useMemo(
    () => project.versions.find((version) => version.id === project.activeVersionId),
    [project.activeVersionId, project.versions]
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

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <TopNav project={project} />
      <section className="grid flex-1 grid-cols-[72px_minmax(0,1fr)_380px] overflow-hidden">
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

        <section className="cad-grid grid min-h-0 grid-rows-[minmax(360px,0.9fr)_minmax(320px,1fr)] gap-4 overflow-auto p-4">
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
                  <p className="mt-1 text-xs text-muted">Active version is the shared data source for plan, model, analysis, MEP and quantity.</p>
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

        <aside className="min-h-0 overflow-auto border-l border-line bg-[#0d141d] p-4">
          <BriefForm value={brief} onChange={setBrief} />

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
              <Info label="Risk count" value={String(activeVersion?.scores?.riskCount ?? 0)} />
            </dl>
          </section>
        </aside>
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
