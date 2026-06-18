"use client";

import { FloorPlan } from "@/components/floor-plan";
import { listComparableLevels } from "@/lib/multi-floor";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

interface VersionSplitCompareProps {
  versions: PlanVersion[];
  compareVersionIds: string[];
  compareLevelId?: string;
  onCompareLevelChange?: (levelId: string) => void;
}

export function VersionSplitCompare({
  versions,
  compareVersionIds,
  compareLevelId,
  onCompareLevelChange
}: VersionSplitCompareProps) {
  const compared = compareVersionIds
    .map((id) => versions.find((version) => version.id === id))
    .filter((version): version is PlanVersion => Boolean(version))
    .slice(0, 2);
  const levelOptions = listComparableLevels(compared.length ? compared : versions);
  const resolvedLevelId = compareLevelId ?? levelOptions[0]?.id;

  if (compared.length < 2) {
    return null;
  }

  return (
    <section className="mb-4 rounded border border-warning/40 bg-warning/5 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Pinned Version Compare</h2>
        <div className="flex items-center gap-2">
          {levelOptions.length > 1 ? (
            <select
              className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
              value={resolvedLevelId}
              onChange={(event) => onCompareLevelChange?.(event.target.value)}
            >
              {levelOptions.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          ) : null}
          <span className="text-xs text-muted">Side-by-side plan read</span>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {compared.map((version) => {
          const quantities = calculateQuantities(version, { levelId: resolvedLevelId, scope: "level" });

          return (
            <article className="rounded border border-line bg-panel/80 p-3" key={version.id}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="truncate text-sm font-medium text-slate-100">{version.label}</h3>
                <span className="text-xs text-muted">{quantities.summary.grossArea} sqm</span>
              </div>
              <FloorPlan
                version={version}
                levelId={resolvedLevelId}
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
