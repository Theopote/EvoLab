import type { PlanVersion } from "@/lib/project-types";

export function resolveCompareVersions(
  versions: PlanVersion[],
  activeVersionId: string,
  compareVersionIds?: string[]
): PlanVersion[] {
  const selected =
    compareVersionIds && compareVersionIds.length >= 2
      ? compareVersionIds
          .map((id) => versions.find((version) => version.id === id))
          .filter((version): version is PlanVersion => Boolean(version))
      : [];

  if (selected.length >= 2) {
    return selected;
  }

  const sorted = [...versions].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  if (sorted.length < 2) {
    return [];
  }

  const activeIndex = sorted.findIndex((version) => version.id === activeVersionId);
  if (activeIndex >= 0) {
    const neighbors = sorted.slice(Math.max(0, activeIndex - 1), activeIndex + 2);
    return neighbors.length >= 2 ? neighbors : sorted.slice(0, 3);
  }

  return sorted.slice(0, Math.min(3, sorted.length));
}
