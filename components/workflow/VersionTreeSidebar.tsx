"use client";

import { GitCompare, Star } from "lucide-react";
import { useMemo } from "react";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";
import { scoreVersion } from "@/lib/version-compare-engine";

interface VersionTreeEntry {
  version: PlanVersion;
  depth: number;
}

function buildVersionTree(versions: PlanVersion[]): VersionTreeEntry[] {
  const byId = new Map(versions.map((version) => [version.id, version]));
  const childrenByParent = new Map<string, PlanVersion[]>();

  versions.forEach((version) => {
    const parentId =
      version.parentVersionId &&
      version.parentVersionId !== version.id &&
      byId.has(version.parentVersionId)
        ? version.parentVersionId
        : "__root__";
    const bucket = childrenByParent.get(parentId) ?? [];
    bucket.push(version);
    childrenByParent.set(parentId, bucket);
  });

  const sortByCreatedAt = (left: PlanVersion, right: PlanVersion) =>
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

  const flat: VersionTreeEntry[] = [];
  const frames: Array<{
    children: PlanVersion[];
    depth: number;
    ancestors: Set<string>;
    index: number;
  }> = [
    {
      children: (childrenByParent.get("__root__") ?? []).sort(sortByCreatedAt),
      depth: 0,
      ancestors: new Set(),
      index: 0
    }
  ];

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];

    if (frame.index >= frame.children.length) {
      frames.pop();
      continue;
    }

    const version = frame.children[frame.index];
    frame.index += 1;
    flat.push({ version, depth: frame.depth });

    if (frame.ancestors.has(version.id)) {
      continue;
    }

    const descendants = (childrenByParent.get(version.id) ?? []).sort(sortByCreatedAt);
    if (descendants.length === 0) {
      continue;
    }

    const nextAncestors = new Set(frame.ancestors);
    nextAncestors.add(version.id);
    frames.push({
      children: descendants,
      depth: frame.depth + 1,
      ancestors: nextAncestors,
      index: 0
    });
  }

  return flat;
}

interface VersionTreeSidebarProps {
  versions: PlanVersion[];
  activeVersionId: string;
  compareVersionIds: string[];
  onSelectVersion: (version: PlanVersion) => void;
  onToggleCompare: (versionId: string) => void;
}

export function VersionTreeSidebar({
  versions,
  activeVersionId,
  compareVersionIds,
  onSelectVersion,
  onToggleCompare
}: VersionTreeSidebarProps) {
  const tree = useMemo(() => buildVersionTree(versions), [versions]);
  const recommendedId = useMemo(
    () => [...versions].sort((left, right) => scoreVersion(right) - scoreVersion(left))[0]?.id,
    [versions]
  );

  if (versions.length === 0) {
    return (
      <div className="rounded border border-dashed border-line bg-panel/50 p-3 text-xs text-muted">
        Generate plan options to build a version tree.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Version Tree</h2>
        <span className="text-[11px] text-muted">{versions.length} options</span>
      </div>

      <div className="space-y-1">
        {tree.map(({ version, depth }) => {
          const quantities = calculateQuantities(version);
          const isActive = version.id === activeVersionId;
          const isCompared = compareVersionIds.includes(version.id);
          const isRecommended = version.id === recommendedId;

          return (
            <div
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2"
              key={version.id}
              style={{ paddingLeft: `${depth * 14}px` }}
            >
              <div className="mt-2 h-full w-px bg-line/80" aria-hidden />
              <button
                className={`rounded border px-2.5 py-2 text-left ${
                  isActive
                    ? "border-accent/70 bg-accent/10"
                    : isCompared
                      ? "border-warning/50 bg-warning/10"
                      : "border-line bg-panel/70 hover:border-accent/40"
                }`}
                type="button"
                onClick={() => onSelectVersion(version)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-medium text-slate-100">{version.label}</span>
                  {isRecommended ? <Star className="h-3 w-3 shrink-0 text-success" /> : null}
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  {version.rooms.length} rooms · {quantities.summary.grossArea} sqm · score {scoreVersion(version)}
                </div>
                {version.metadata?.strategy ? (
                  <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted">{version.metadata.strategy}</div>
                ) : null}
              </button>
              <button
                className={`mt-1 grid h-8 w-8 place-items-center rounded border ${
                  isCompared ? "border-warning/60 text-warning" : "border-line text-muted hover:border-accent/50"
                }`}
                type="button"
                title="Pin for compare"
                aria-label={`Compare ${version.label}`}
                onClick={() => onToggleCompare(version.id)}
              >
                <GitCompare className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {compareVersionIds.length >= 2 ? (
        <div className="rounded border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">
          Comparing {compareVersionIds.length} pinned versions in the viewport split.
        </div>
      ) : (
        <div className="text-[11px] text-muted">Pin up to 2 versions with the compare icon.</div>
      )}
    </div>
  );
}
