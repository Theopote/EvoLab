"use client";

import { useMemo, useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import { applyRelativePan, formatViewBox, parseViewBox, viewBoxFromVersionBounds } from "@/lib/comparison-viewport";
import type { ComparisonViewport } from "@/lib/comparison-viewport-types";
import type { PlanVersion } from "@/lib/project-types";
import { ensureVersionScores, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";
import type { ProjectDomain } from "@/lib/building-domain";

interface SchemeCompareGridProps {
  versions: PlanVersion[];
  levelId?: string;
  domain?: ProjectDomain;
  projectType?: string;
}

export function SchemeCompareGrid({ versions, levelId, domain, projectType }: SchemeCompareGridProps) {
  const scoringInput = useMemo(
    () => (domain ? scoringInputFromDomain(domain, projectType) : { projectType }),
    [domain, projectType]
  );
  const scored = useMemo(
    () => versions.map((version) => ensureVersionScores(version, scoringInput)),
    [scoringInput, versions]
  );

  const baseViewport = useMemo(() => {
    const reference = versions[0];

    if (!reference) {
      return undefined;
    }

    return viewBoxFromVersionBounds(reference.overallBounds.width, reference.overallBounds.height);
  }, [versions]);

  const [leaderViewport, setLeaderViewport] = useState<ComparisonViewport | undefined>(baseViewport);
  const leaderViewBox = leaderViewport ? formatViewBox(leaderViewport) : undefined;

  if (versions.length < 2) {
    return null;
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Side-by-side comparison</h2>
          <p className="mt-1 text-xs text-muted">Shared viewport — pan/zoom on the first plan syncs the others.</p>
        </div>
        <button
          className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={() => setLeaderViewport(baseViewport)}
        >
          Reset view
        </button>
      </div>

      <div className="mb-3 overflow-hidden rounded border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2">Metric</th>
              {scored.map((version) => (
                <th className="px-3 py-2 text-right" key={version.id}>
                  {version.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <MetricRow label="Area efficiency" values={scored.map((version) => version.scores?.areaEfficiency ?? 0)} />
            <MetricRow label="Circulation" values={scored.map((version) => version.scores?.circulationScore ?? 0)} highlight />
            <MetricRow label="Daylight" values={scored.map((version) => version.scores?.daylightScore ?? 0)} />
            <MetricRow label="MEP alignment" values={scored.map((version) => version.scores?.mepAlignmentScore ?? 0)} />
            <MetricRow label="Risk items" values={scored.map((version) => version.scores?.riskCount ?? 0)} />
          </tbody>
        </table>
      </div>

      <div className={`grid gap-3 ${versions.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {scored.map((version, index) => {
          const followerBase = viewBoxFromVersionBounds(version.overallBounds.width, version.overallBounds.height);
          const syncedViewport =
            index === 0 || !leaderViewport
              ? leaderViewport
              : applyRelativePan(baseViewport ?? followerBase, followerBase, leaderViewport);
          const viewBox = syncedViewport ? formatViewBox(syncedViewport) : undefined;

          return (
            <article className="rounded border border-line bg-[#0b1118] p-2" key={version.id}>
              <div className="mb-2 text-xs font-medium text-slate-100">{version.label}</div>
              <FloorPlan
                version={version}
                levelId={levelId}
                className="[&>div]:min-h-[200px] [&_svg]:min-h-[200px]"
                interactive={false}
                viewBoxOverride={viewBox}
                enableComparisonPan={index === 0}
                onViewBoxChange={(nextViewBox) => {
                  if (index !== 0) {
                    return;
                  }

                  const parsed = parseViewBox(nextViewBox);

                  if (parsed) {
                    setLeaderViewport(parsed);
                  }
                }}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetricRow({
  label,
  values,
  highlight = false
}: {
  label: string;
  values: number[];
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-success/10" : "border-t border-line"}>
      <td className="px-3 py-2 text-slate-100">{label}</td>
      {values.map((value, index) => (
        <td className="px-3 py-2 text-right text-muted" key={`${label}-${index}`}>
          {value}
        </td>
      ))}
    </tr>
  );
}
