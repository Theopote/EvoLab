"use client";

import { FloorPlan } from "@/components/floor-plan";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

interface VersionSplitCompareProps {
  versions: PlanVersion[];
  compareVersionIds: string[];
}

export function VersionSplitCompare({ versions, compareVersionIds }: VersionSplitCompareProps) {
  const compared = compareVersionIds
    .map((id) => versions.find((version) => version.id === id))
    .filter((version): version is PlanVersion => Boolean(version))
    .slice(0, 2);

  if (compared.length < 2) {
    return null;
  }

  return (
    <section className="mb-4 rounded border border-warning/40 bg-warning/5 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Pinned Version Compare</h2>
        <span className="text-xs text-muted">Side-by-side plan read</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {compared.map((version) => {
          const quantities = calculateQuantities(version);

          return (
            <article className="rounded border border-line bg-panel/80 p-3" key={version.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-medium text-slate-100">{version.label}</h3>
                <span className="text-xs text-muted">{quantities.summary.grossArea} sqm</span>
              </div>
              <FloorPlan
                version={version}
                className="[&>div]:min-h-[220px] [&_svg]:min-h-[220px]"
                interactive={false}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
