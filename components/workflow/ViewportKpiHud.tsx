"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { formatCost, calculateCostEstimate } from "@/lib/cost-engine";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";
import { useEvoProject } from "@/lib/project-store";

function polygonArea(points: Array<[number, number]>) {
  const area = points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return total + x * nextY - nextX * y;
  }, 0);

  return Math.abs(area) / 2;
}

function scoreVersion(version: PlanVersion) {
  const scores = version.scores;

  return Math.round(
    Math.max(
      0,
      (scores?.areaEfficiency ?? 0) * 0.28 +
        (scores?.circulationScore ?? 0) * 0.26 +
        (scores?.daylightScore ?? 0) * 0.2 +
        (scores?.mepAlignmentScore ?? 0) * 0.18 -
        (scores?.riskCount ?? 0) * 4
    )
  );
}

export function ViewportKpiHud() {
  const { project, activeVersion, outline, zoning, buildableEnvelope } = useEvoProject(
    useShallow((state) => ({
      project: state.project,
      activeVersion: state.activeVersion,
      outline: state.outline,
      zoning: state.zoning,
      buildableEnvelope: state.buildableEnvelope
    }))
  );

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
      { label: "Score", value: String(scoreVersion(activeVersion)), tone: "default" as const },
      {
        label: "Envelope",
        value: buildableEnvelope?.valid ? "OK" : "—",
        tone: buildableEnvelope?.valid ? ("success" as const) : ("default" as const)
      }
    ];
  }, [activeVersion, buildableEnvelope?.valid, outline, project.projectType, zoning.maxFar]);

  if (!metrics) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-wrap justify-end gap-2">
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
