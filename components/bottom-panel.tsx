"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileStack, Layers3, Ruler, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { ScoreBreakdownPanel } from "@/components/score/ScoreBreakdownPanel";
import { ScoringConfigPanel } from "@/components/score/ScoringConfigPanel";
import { groupComplianceItems } from "@/lib/compliance-groups";
import { useProjectActions } from "@/lib/project-store";
import type { ComplianceItem, QuantityResult } from "@/lib/quantity-engine";
import type { PlanVersion, ProjectData } from "@/lib/project-types";
import { scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";

type BottomPanelTab = "tasks" | "versions" | "scores" | "quantities" | "warnings" | "sheets";
type ScoresSubTab = "breakdown" | "configure";

interface BottomPanelProps {
  project: ProjectData;
  activeVersion?: PlanVersion;
  quantities?: QuantityResult;
  complianceItems: ComplianceItem[];
  onSelectVersion: (version: PlanVersion) => void;
}

const tabs: { id: BottomPanelTab; label: string }[] = [
  { id: "tasks", label: "AI Tasks" },
  { id: "versions", label: "Versions" },
  { id: "scores", label: "Scores" },
  { id: "quantities", label: "Quantities" },
  { id: "warnings", label: "Warnings" },
  { id: "sheets", label: "Presentation" }
];

export function BottomPanel({
  project,
  activeVersion,
  quantities,
  complianceItems,
  onSelectVersion
}: BottomPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<BottomPanelTab>("tasks");
  const [scoresSubTab, setScoresSubTab] = useState<ScoresSubTab>("breakdown");
  const { updateScoringConfig, resetScoringConfig } = useProjectActions();
  const warningCount = complianceItems.filter((item) => item.status === "warning").length;
  const complianceGroups = useMemo(
    () => groupComplianceItems(complianceItems, activeVersion),
    [complianceItems, activeVersion]
  );
  const scoringInput = useMemo(() => scoringInputFromDomain(project.domain, project.projectType), [project.domain, project.projectType]);
  const scoredActiveVersion = useMemo(() => activeVersion, [activeVersion, scoringInput]);
  const taskRows = useMemo(
    () => [
      {
        label: "Plan options generated",
        done: project.versions.length > 0,
        detail: `${project.versions.length} version${project.versions.length === 1 ? "" : "s"}`
      },
      {
        label: "Analysis overlays available",
        done: Boolean(activeVersion),
        detail: activeVersion ? "Data-driven layers ready" : "Waiting for active version"
      },
      {
        label: "3D massing generated",
        done: Boolean(activeVersion?.rooms.length),
        detail: activeVersion ? `${activeVersion.rooms.length} rooms converted` : "No version"
      },
      {
        label: "MEP risers proposed",
        done: Boolean(activeVersion?.mep),
        detail: activeVersion?.mep ? `${activeVersion.mep.routes.length} routes` : "Rule preview only"
      },
      {
        label: "Quantity takeoff calculated",
        done: Boolean(quantities),
        detail: quantities ? `${quantities.summary.grossArea} sqm gross` : "No quantities"
      }
    ],
    [activeVersion, project.versions.length, quantities]
  );

  return (
    <section className="border-t border-line bg-[#0a0f15]">
      <button
        className="flex h-9 w-full items-center justify-between border-b border-line px-3 text-left transition hover:bg-white/[0.02]"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-medium text-slate-200">{activeVersion?.label ?? "无活动版本"}</span>
          <span className="text-muted">
            {project.versions.length} 版本 · {quantities ? `${quantities.summary.grossArea} ㎡` : "— ㎡"}
          </span>
          <span className={warningCount > 0 ? "text-warning" : "text-success"}>
            {warningCount} 条警告
          </span>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted">
          {expanded ? "收起" : "展开指标面板"}
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5 rotate-180" />}
        </span>
      </button>

      {expanded ? (
        <>
          <div className="flex h-9 items-center justify-between border-b border-line px-3">
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  className={`h-7 rounded px-3 text-xs ${
                    activeTab === tab.id
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-white/[0.04] hover:text-slate-100"
                  }`}
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{activeVersion?.label ?? "No active version"}</span>
              <span className={warningCount > 0 ? "text-warning" : "text-success"}>
                {warningCount} warnings
              </span>
            </div>
          </div>

          <div className={`overflow-auto p-3 ${activeTab === "scores" ? "h-[22rem]" : "h-44"}`}>
        {activeTab === "tasks" ? (
          <div className="grid gap-2 lg:grid-cols-5">
            {taskRows.map((task) => (
              <div className="rounded border border-line bg-panel/70 p-3" key={task.label}>
                <div className="mb-2 flex items-center justify-between">
                  {task.done ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  )}
                  <span className="rounded border border-line px-2 py-0.5 text-[11px] text-muted">
                    {task.done ? "Done" : "Open"}
                  </span>
                </div>
                <div className="text-sm text-slate-100">{task.label}</div>
                <div className="mt-1 text-xs text-muted">{task.detail}</div>
              </div>
            ))}
          </div>
        ) : null}

        {activeTab === "versions" ? (
          <div className="grid gap-2 lg:grid-cols-4">
            {project.versions.map((version) => (
              <button
                className={`rounded border p-3 text-left ${
                  version.id === project.activeVersionId
                    ? "border-accent/70 bg-accent/10"
                    : "border-line bg-panel/70 hover:border-accent/50"
                }`}
                key={version.id}
                type="button"
                onClick={() => onSelectVersion(version)}
              >
                <div className="truncate text-sm text-slate-100">{version.label}</div>
                <div className="mt-2 grid grid-cols-5 gap-1 text-[11px] text-muted">
                  <span>A {version.scores?.areaEfficiency ?? 0}</span>
                  <span>F {version.scores?.circulationScore ?? 0}</span>
                  <span>D {version.scores?.daylightScore ?? 0}</span>
                  <span>E {version.scores?.egressScore ?? 0}</span>
                  <span>R {version.scores?.riskCount ?? 0}</span>
                </div>
                {version.scores?.breakdown?.comparisonHints[0] ? (
                  <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-muted">
                    {version.scores.breakdown.comparisonHints[0]}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {activeTab === "scores" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[
                { id: "breakdown" as const, label: "Breakdown" },
                { id: "configure" as const, label: "Rules & weights" }
              ].map((tab) => (
                <button
                  className={`h-7 rounded px-3 text-xs ${
                    scoresSubTab === tab.id
                      ? "border border-accent/40 bg-accent/10 text-accent"
                      : "border border-transparent text-muted hover:text-slate-100"
                  }`}
                  key={tab.id}
                  type="button"
                  onClick={() => setScoresSubTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {scoresSubTab === "breakdown" ? (
              scoredActiveVersion ? (
                <ScoreBreakdownPanel
                  version={scoredActiveVersion}
                  program={project.domain.program}
                  projectType={project.projectType}
                />
              ) : (
                <div className="rounded border border-line bg-panel/70 p-3 text-sm text-muted">
                  Select an active version to inspect score evidence.
                </div>
              )
            ) : (
              <ScoringConfigPanel
                domain={project.domain}
                projectType={project.projectType}
                onChange={updateScoringConfig}
                onReset={resetScoringConfig}
              />
            )}
          </div>
        ) : null}

        {activeTab === "quantities" ? (
          <div className="grid gap-2 lg:grid-cols-6">
            {quantities ? (
              [
                ["Gross area", `${quantities.summary.grossArea} sqm`, Ruler],
                ["Net area", `${quantities.summary.netUsableArea} sqm`, Ruler],
                ["Wall area", `${quantities.summary.wallArea} sqm`, Layers3],
                ["Doors", `${quantities.summary.doorCount} pcs`, ScrollText],
                ["Windows", `${quantities.summary.windowCount} pcs`, ScrollText],
                ["Roof", `${quantities.summary.roofArea} sqm`, FileStack]
              ].map(([label, value, Icon]) => (
                <div className="rounded border border-line bg-panel/70 p-3" key={String(label)}>
                  <Icon className="mb-2 h-4 w-4 text-accent" />
                  <div className="text-xs text-muted">{label as string}</div>
                  <div className="mt-1 text-sm text-slate-100">{value as string}</div>
                </div>
              ))
            ) : (
              <div className="rounded border border-line bg-panel/70 p-3 text-sm text-muted">
                No quantity result.
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "warnings" ? (
          <div className="space-y-4">
            {complianceGroups.map((group) => (
              <section className="space-y-2" key={group.id}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{group.label}</h3>
                  <span className="text-[11px] text-muted">
                    {group.warningCount > 0 ? `${group.warningCount} warning(s)` : `${group.successCount} passed`}
                  </span>
                </div>
                <div className="grid gap-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <div className="rounded border border-line bg-panel/70 p-3" key={item.id}>
                      <div className="mb-1 flex items-center gap-2">
                        {item.status === "warning" ? (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                        <span className="text-sm text-slate-100">{item.title}</span>
                      </div>
                      <div className="text-xs leading-5 text-muted">{item.message}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {activeTab === "sheets" ? (
          <div className="grid gap-2 lg:grid-cols-5">
            {[
              ["A-101", "Floor plan", Boolean(activeVersion)],
              ["A-201", "Analysis diagram", Boolean(activeVersion)],
              ["M-101", "Concept MEP", Boolean(activeVersion?.mep)],
              ["Q-101", "Quantity takeoff", Boolean(quantities)],
              ["V-001", "Version compare", project.versions.length > 1]
            ].map(([code, label, ready]) => (
              <div className="rounded border border-line bg-panel/70 p-3" key={String(code)}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-100">{code as string}</span>
                  <span className={ready ? "text-xs text-success" : "text-xs text-muted"}>
                    {ready ? "Ready" : "Pending"}
                  </span>
                </div>
                <div className="text-xs text-muted">{label as string}</div>
              </div>
            ))}
          </div>
        ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
