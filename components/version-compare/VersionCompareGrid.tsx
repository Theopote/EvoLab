"use client";

import { Boxes, Check, GitCompare, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

interface VersionCompareGridProps {
  versions: PlanVersion[];
  activeVersionId: string;
  onSelectVersion: (version: PlanVersion) => void;
  onGenerateModel: (version: PlanVersion) => void;
  onRefineVersion: (version: PlanVersion) => void;
}

function scoreVersion(version: PlanVersion) {
  const scores = version.scores;
  const total =
    (scores?.areaEfficiency ?? 0) * 0.28 +
    (scores?.circulationScore ?? 0) * 0.26 +
    (scores?.daylightScore ?? 0) * 0.2 +
    (scores?.mepAlignmentScore ?? 0) * 0.18 -
    (scores?.riskCount ?? 0) * 4;

  return Math.round(Math.max(0, total));
}

export function VersionCompareGrid({
  versions,
  activeVersionId,
  onSelectVersion,
  onGenerateModel,
  onRefineVersion
}: VersionCompareGridProps) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const recommendedId = useMemo(
    () => [...versions].sort((a, b) => scoreVersion(b) - scoreVersion(a))[0]?.id,
    [versions]
  );
  const comparedVersions = versions.filter((version) => compareIds.includes(version.id));

  function toggleCompare(versionId: string) {
    setCompareIds((current) =>
      current.includes(versionId)
        ? current.filter((id) => id !== versionId)
        : [...current, versionId].slice(-3)
    );
  }

  if (versions.length === 0) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate plan options before comparing versions.
      </div>
    );
  }

  return (
    <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="rounded border border-line bg-panel/90 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Version Compare</h1>
            <p className="mt-1 text-xs text-muted">Compare editable PlanVersion options and promote one as active.</p>
          </div>
          <span className="rounded border border-line px-2 py-1 text-xs text-muted">
            {versions.length} versions
          </span>
        </div>
      </div>

      <div className="min-h-0 overflow-auto">
        <div className="grid gap-3 xl:grid-cols-3">
          {versions.map((version) => {
            const quantities = calculateQuantities(version);
            const totalScore = scoreVersion(version);
            const isActive = version.id === activeVersionId;
            const isRecommended = version.id === recommendedId;
            const isCompared = compareIds.includes(version.id);

            return (
              <article
                className={`rounded border bg-panel/90 p-3 ${
                  isActive ? "border-accent/70" : "border-line"
                }`}
                key={version.id}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white">{version.label}</h2>
                    <p className="mt-1 text-xs text-muted">{version.rooms.length} rooms / {quantities.summary.grossArea} sqm</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {isRecommended ? (
                      <span className="flex items-center gap-1 rounded border border-success/40 px-2 py-1 text-[11px] text-success">
                        <Sparkles className="h-3 w-3" />
                        Recommended
                      </span>
                    ) : null}
                    {isActive ? (
                      <span className="rounded border border-accent/40 px-2 py-1 text-[11px] text-accent">Active</span>
                    ) : null}
                  </div>
                </div>

                <FloorPlan
                  version={version}
                  className="mb-3 [&>div]:min-h-[210px] [&_svg]:min-h-[210px]"
                  interactive={false}
                />

                <div className="mb-3 grid grid-cols-5 gap-2 text-xs">
                  <Metric label="Total" value={totalScore} />
                  <Metric label="Area" value={version.scores?.areaEfficiency ?? 0} />
                  <Metric label="Flow" value={version.scores?.circulationScore ?? 0} />
                  <Metric label="Light" value={version.scores?.daylightScore ?? 0} />
                  <Metric label="MEP" value={version.scores?.mepAlignmentScore ?? 0} />
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                  <Data label="Risks" value={String(version.scores?.riskCount ?? 0)} tone="warning" />
                  <Data label="Walls" value={`${quantities.summary.wallArea} sqm`} />
                  <Data label="Windows" value={String(quantities.summary.windowCount)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
                    type="button"
                    onClick={() => onSelectVersion(version)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Set Active
                  </button>
                  <button
                    className={`flex h-8 items-center justify-center gap-2 rounded border text-xs ${
                      isCompared
                        ? "border-accent/60 text-accent"
                        : "border-line text-slate-100 hover:border-accent/60 hover:text-accent"
                    }`}
                    type="button"
                    onClick={() => toggleCompare(version.id)}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Compare
                  </button>
                  <button
                    className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
                    type="button"
                    onClick={() => onRefineVersion(version)}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Refine
                  </button>
                  <button
                    className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
                    type="button"
                    onClick={() => onGenerateModel(version)}
                  >
                    <Boxes className="h-3.5 w-3.5" />
                    Model
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {comparedVersions.length ? (
          <section className="mt-4 rounded border border-line bg-panel/90 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Pinned comparison</h2>
              <span className="text-xs text-muted">{comparedVersions.length} selected</span>
            </div>
            <div className="overflow-hidden rounded border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-muted">
                  <tr>
                    <th className="px-3 py-2">Version</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">Area</th>
                    <th className="px-3 py-2 text-right">Flow</th>
                    <th className="px-3 py-2 text-right">Daylight</th>
                    <th className="px-3 py-2 text-right">MEP</th>
                    <th className="px-3 py-2 text-right">Risks</th>
                  </tr>
                </thead>
                <tbody>
                  {comparedVersions.map((version) => (
                    <tr className="border-t border-line" key={`compare-${version.id}`}>
                      <td className="px-3 py-2 text-slate-100">{version.label}</td>
                      <td className="px-3 py-2 text-right text-slate-100">{scoreVersion(version)}</td>
                      <td className="px-3 py-2 text-right text-muted">{version.scores?.areaEfficiency ?? 0}</td>
                      <td className="px-3 py-2 text-right text-muted">{version.scores?.circulationScore ?? 0}</td>
                      <td className="px-3 py-2 text-right text-muted">{version.scores?.daylightScore ?? 0}</td>
                      <td className="px-3 py-2 text-right text-muted">{version.scores?.mepAlignmentScore ?? 0}</td>
                      <td className="px-3 py-2 text-right text-warning">{version.scores?.riskCount ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2 text-center">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function Data({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-1 text-xs ${tone === "warning" ? "text-warning" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
