import { getLevelById } from "@/lib/level-rooms";
import { findStandardFloorGroup, standardFloorGroupLabel } from "@/lib/standard-floor-group";
import type { PlanScopeKind } from "@/lib/plan-scope";
import { calculateQuantities, type QuantityResult } from "@/lib/quantity-engine";
import { calculateScoresWithBreakdown } from "@/lib/plan-scoring";
import type { PlanVersion, VersionScores } from "@/lib/project-types";
import type { ScoreBreakdown } from "@/lib/rules/types";
import type { PlanValidationIssue } from "@/lib/plan-validation";

export interface MetricsScopeContext {
  scope: PlanScopeKind;
  levelId?: string;
  standardFloorGroupId?: string;
}

export interface MetricsScopeOption {
  scope: PlanScopeKind;
  label: string;
  enabled: boolean;
}

export function resolveMetricsScopeContext(
  version: PlanVersion | undefined,
  scope: PlanScopeKind,
  activeLevelId?: string
): MetricsScopeContext {
  if (!version) {
    return { scope: "building" };
  }

  if (scope === "level" && activeLevelId) {
    return { scope: "level", levelId: activeLevelId };
  }

  if (scope === "floor_group") {
    const level = getLevelById(version, activeLevelId);
    const groupId = level?.standardFloorGroupId ?? version.standardFloorGroups?.[0]?.id;

    if (groupId) {
      return { scope: "floor_group", standardFloorGroupId: groupId, levelId: activeLevelId };
    }
  }

  return { scope: "building" };
}

export function metricsScopeOptions(version: PlanVersion | undefined, activeLevelId?: string): MetricsScopeOption[] {
  const level = version ? getLevelById(version, activeLevelId) : undefined;
  const group = findStandardFloorGroup(version?.standardFloorGroups, level?.standardFloorGroupId);

  return [
    { scope: "building", label: "Building", enabled: Boolean(version && version.levels.length > 0) },
    {
      scope: "level",
      label: level ? level.name : "Level",
      enabled: Boolean(version && activeLevelId)
    },
    {
      scope: "floor_group",
      label: group ? standardFloorGroupLabel(group, version?.levels ?? []) : "Standard floor group",
      enabled: Boolean(version && group)
    }
  ];
}

export function metricsScopeCaption(
  version: PlanVersion | undefined,
  context: MetricsScopeContext,
  activeLevelId?: string
): string {
  if (context.scope === "building") {
    return version && version.levels.length > 1
      ? `${version.levels.length} physical floors · summed metrics`
      : "Whole scheme metrics";
  }

  if (context.scope === "level") {
    const level = getLevelById(version, context.levelId ?? activeLevelId);
    return level ? `${level.name}${level.isTransferFloor ? " · transfer floor" : ""}` : "Active level";
  }

  const group = findStandardFloorGroup(version?.standardFloorGroups, context.standardFloorGroupId);
  return group ? `${standardFloorGroupLabel(group, version?.levels ?? [])} template` : "Standard floor group";
}

export function calculateScopedQuantities(
  version: PlanVersion,
  scope: PlanScopeKind,
  activeLevelId?: string
): QuantityResult {
  const context = resolveMetricsScopeContext(version, scope, activeLevelId);
  return calculateQuantities(version, context);
}

export function calculateScopedScores(
  version: PlanVersion,
  scope: PlanScopeKind,
  activeLevelId?: string,
  issues: PlanValidationIssue[] = [],
  options: Omit<Parameters<typeof calculateScoresWithBreakdown>[2], "scope" | "levelId" | "standardFloorGroupId"> = {}
): { scores: VersionScores; breakdown: ScoreBreakdown } {
  const context = resolveMetricsScopeContext(version, scope, activeLevelId);

  return calculateScoresWithBreakdown(version, issues, {
    ...options,
    scope: context.scope,
    levelId: context.levelId,
    standardFloorGroupId: context.standardFloorGroupId
  });
}
