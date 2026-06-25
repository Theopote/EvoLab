"use client";

import { GitCompareArrows } from "lucide-react";
import { useMemo } from "react";
import { formatCost, calculateCostEstimate } from "@/lib/cost-engine";
import { getProgramGoals } from "@/lib/project-domain";
import { calculateQuantities } from "@/lib/quantity-engine";
import { useProjectActions, useProjectState, useSiteState } from "@/lib/project-store";
import { computeTotalScore } from "@/lib/rules/version-total-score";
import { tabForSchemeSubview } from "@/lib/workflow-phases";

function polygonArea(points: Array<[number, number]>) {
  const area = points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return total + x * nextY - nextX * y;
  }, 0);

  return Math.abs(area) / 2;
}

export function ViewportKpiHud() {
  const { project, activeVersion, activeTab, compareModeOpen, compareVersionIds } = useProjectState((state) => ({
    project: state.project,
    activeVersion: state.activeVersion,
    activeTab: state.activeTab,
    compareModeOpen: state.compareModeOpen,
    compareVersionIds: state.compareVersionIds
  }));
  const { outline, zoning, buildableEnvelope } = useSiteState((state) => ({
    outline: state.outline,
    zoning: state.zoning,
    buildableEnvelope: state.buildableEnvelope
  }));
  const { setCompareModeOpen, setActiveTab, setWorkflowPhase } = useProjectActions();
  const isCompareActive = activeTab === "Compare" || compareModeOpen;

  const metrics = useMemo(() => {
    if (!activeVersion) {
      return null;
    }

    const quantities = calculateQuantities(activeVersion);
    const cost = calculateCostEstimate(activeVersion, project.projectType);
    const siteArea = polygonArea(outline);
    const far = siteArea > 0 ? quantities.summary.grossArea / siteArea : undefined;
    const farLimit = zoning.maxFar;

    return [
      { label: "GFA", value: `${quantities.summary.grossArea} sqm`, tone: "default" as const },
      {
        label: "FAR",
        value: far !== undefined ? far.toFixed(2) : "—",
        hint: far !== undefined ? `limit ${farLimit}` : undefined,
        tone: far !== undefined && far > farLimit ? ("warning" as const) : ("default" as const)
      },
      { label: "ROM", value: formatCost(cost.totalCost, cost.currency), tone: "default" as const },
      {
        label: "Score",
        value: String(
          computeTotalScore(
            activeVersion.scores ?? {
              areaEfficiency: 0,
              circulationScore: 0,
              daylightScore: 0,
              mepAlignmentScore: 0,
              riskCount: 0
            },
            getProgramGoals(project.domain)
          )
        ),
        tone: "default" as const
      },
      {
        label: "Envelope",
        value: buildableEnvelope?.valid ? "OK" : "—",
        tone: buildableEnvelope?.valid ? ("success" as const) : ("default" as const)
      }
    ];
  }, [activeVersion, buildableEnvelope?.valid, outline, project.domain, project.projectType, zoning.maxFar]);

  if (!metrics) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2">
      <button
        className={`pointer-events-auto flex h-auto items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur ${
          isCompareActive
            ? "border-accent/60 bg-accent/15 text-accent"
            : "border-line/80 bg-[#0b1118]/92 text-slate-200 hover:border-accent/50"
        }`}
        type="button"
        onClick={() => {
          if (isCompareActive) {
            setCompareModeOpen(false);
            if (activeTab === "Compare") {
              setActiveTab(tabForSchemeSubview("plan"));
            }
            return;
          }

          setWorkflowPhase("scheme");
          setActiveTab(tabForSchemeSubview("compare"));
          setCompareModeOpen(true);
        }}
      >
        <GitCompareArrows className="h-3.5 w-3.5" />
        Compare
        {compareVersionIds.length > 0 ? (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{compareVersionIds.length}</span>
        ) : null}
      </button>
      {metrics.map((metric) => (
        <div
          className="pointer-events-auto rounded-lg border border-line/80 bg-[#0b1118]/92 px-3 py-2 shadow-lg backdrop-blur"
          key={metric.label}
        >
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{metric.label}</div>
          <div
            className={`mt-0.5 text-sm font-semibold ${
              metric.tone === "warning"
                ? "text-warning"
                : metric.tone === "success"
                  ? "text-success"
                  : "text-slate-100"
            }`}
          >
            {metric.value}
          </div>
          {"hint" in metric && metric.hint ? <div className="text-[10px] text-muted">{metric.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
