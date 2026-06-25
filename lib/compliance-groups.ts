import type { ComplianceItem } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

export interface ComplianceGroup {
  id: string;
  label: string;
  kind: "building_wide" | "level";
  levelId?: string;
  warningCount: number;
  successCount: number;
  items: ComplianceItem[];
}

export interface ComplianceGroupSummary {
  totalWarnings: number;
  totalSuccess: number;
  levelGroupCount: number;
  buildingWideWarnings: number;
}

export function groupComplianceItems(items: ComplianceItem[], version?: PlanVersion): ComplianceGroup[] {
  const buildingWide: ComplianceItem[] = [];
  const byLevel = new Map<string, ComplianceItem[]>();

  items.forEach((item) => {
    if (item.scope === "building_wide" || !item.levelId) {
      buildingWide.push(item);
      return;
    }

    const bucket = byLevel.get(item.levelId) ?? [];
    bucket.push(item);
    byLevel.set(item.levelId, bucket);
  });

  const groups: ComplianceGroup[] = [];

  if (buildingWide.length > 0) {
    groups.push({
      id: "building-wide",
      label: "Building-wide",
      kind: "building_wide",
      warningCount: buildingWide.filter((item) => item.status === "warning").length,
      successCount: buildingWide.filter((item) => item.status === "success").length,
      items: buildingWide
    });
  }

  const orderedLevelIds = [
    ...(version?.levels.map((level) => level.id) ?? []),
    ...[...byLevel.keys()].filter((levelId) => !version?.levels.some((level) => level.id === levelId))
  ];

  orderedLevelIds.forEach((levelId) => {
    const levelItems = byLevel.get(levelId);

    if (!levelItems?.length) {
      return;
    }

    const level = version?.levels.find((item) => item.id === levelId);

    groups.push({
      id: levelId,
      label: level?.name ?? levelItems[0]?.levelName ?? levelId,
      kind: "level",
      levelId,
      warningCount: levelItems.filter((item) => item.status === "warning").length,
      successCount: levelItems.filter((item) => item.status === "success").length,
      items: levelItems
    });
    byLevel.delete(levelId);
  });

  byLevel.forEach((levelItems, levelId) => {
    groups.push({
      id: levelId,
      label: levelItems[0]?.levelName ?? levelId,
      kind: "level",
      levelId,
      warningCount: levelItems.filter((item) => item.status === "warning").length,
      successCount: levelItems.filter((item) => item.status === "success").length,
      items: levelItems
    });
  });

  return groups;
}

export function summarizeComplianceGroups(groups: ComplianceGroup[]): ComplianceGroupSummary {
  return {
    totalWarnings: groups.reduce((total, group) => total + group.warningCount, 0),
    totalSuccess: groups.reduce((total, group) => total + group.successCount, 0),
    levelGroupCount: groups.filter((group) => group.kind === "level").length,
    buildingWideWarnings: groups.find((group) => group.kind === "building_wide")?.warningCount ?? 0
  };
}

export function prioritizeComplianceItems(items: ComplianceItem[], activeLevelId?: string) {
  if (!activeLevelId) {
    return items;
  }

  return [...items].sort((left, right) => scoreComplianceItem(left, activeLevelId) - scoreComplianceItem(right, activeLevelId));
}

function scoreComplianceItem(item: ComplianceItem, activeLevelId: string) {
  if (item.levelId === activeLevelId) {
    return 0;
  }

  if (item.scope === "building_wide") {
    return 1;
  }

  return 2;
}
