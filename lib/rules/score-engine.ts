import { resolveRulePack } from "@/lib/rules/rule-pack";
import { normalizeGoalWeights, resolveProgramGoalsFromContext } from "@/lib/rules/program-goals";
import { scoreAreaEfficiency } from "@/lib/rules/metrics/area-efficiency";
import { scoreCirculation } from "@/lib/rules/metrics/circulation";
import { scoreDaylight } from "@/lib/rules/metrics/daylight";
import { scoreEgress } from "@/lib/rules/metrics/egress";
import { scoreStructureFit } from "@/lib/rules/metrics/structure-fit";
import { scoreWetCore } from "@/lib/rules/metrics/wet-core";
import type {
  MetricContribution,
  ProgramGoals,
  RulePack,
  ScoreBreakdown,
  ScoringContext
} from "@/lib/rules/types";
import { buildComplianceContext, computeRiskCount, runComplianceCheck } from "@/lib/compliance-rules";
import type { CodeContext, ProgramModel, ScoringConfig } from "@/lib/building-domain";
import type { PlanVersion, VersionScores } from "@/lib/project-types";
import type { PlanValidationIssue } from "@/lib/plan-validation";
import { computeTotalScore } from "@/lib/rules/version-total-score";
import {
  filterIssuesForScope,
  resolvePlanScope,
  type PlanScopeKind,
  versionForScoringScope
} from "@/lib/plan-scope";
import type { ComplianceResult } from "@/lib/compliance-rules";

export interface ScoreEngineOptions {
  issues?: PlanValidationIssue[];
  codeContext?: CodeContext;
  program?: ProgramModel;
  projectType?: string;
  scoringConfig?: ScoringConfig;
  orientationDeg?: number;
  levelId?: string;
  standardFloorGroupId?: string;
  scope?: PlanScopeKind;
  rulePack?: RulePack;
  programGoals?: ProgramGoals;
}

const buildMetricContribution = (
  metric: ReturnType<typeof scoreAreaEfficiency>,
  id: MetricContribution["id"],
  label: string,
  weight: number
): MetricContribution => ({
  id,
  label,
  score: metric.score,
  weight,
  weightedScore: Math.round(metric.score * weight),
  summary: metric.summary,
  evidence: metric.evidence
});

function filterComplianceResultsForScope(results: ComplianceResult[], context: ScoringContext) {
  if (context.scope === "building" || !context.scope) {
    return results;
  }

  if (context.scope === "floor_group") {
    const levelIds = new Set(context.version.levels.map((level) => level.id));
    return results.filter(
      (result) =>
        result.scope === "building_wide" ||
        !result.levelId ||
        (result.levelId && levelIds.has(result.levelId))
    );
  }

  const levelId = context.levelId ?? context.version.levels[0]?.id;
  return results.filter(
    (result) => result.scope === "building_wide" || !result.levelId || result.levelId === levelId
  );
}

function resolveScoreScope(version: PlanVersion, options: ScoreEngineOptions): PlanScopeKind {
  return resolvePlanScope(version, {
    levelId: options.levelId,
    standardFloorGroupId: options.standardFloorGroupId,
    scope: options.scope
  }).scope;
}

function buildScoringContext(version: PlanVersion, options: ScoreEngineOptions): ScoringContext {
  const scope = resolveScoreScope(version, options);
  const scopeOptions = {
    levelId: options.levelId,
    standardFloorGroupId: options.standardFloorGroupId,
    scope
  };

  return {
    version: versionForScoringScope(version, scopeOptions),
    issues: filterIssuesForScope(options.issues, version, scopeOptions),
    rulePack: options.rulePack ?? resolveRulePack({ codeContext: options.codeContext, projectType: options.projectType ?? options.program?.projectType }),
    programGoals:
      options.programGoals ??
      resolveProgramGoalsFromContext({
        program: options.program,
        projectType: options.projectType
      }),
    orientationDeg: options.orientationDeg,
    levelId: options.levelId ?? (scope === "level" ? scopeOptions.levelId : undefined),
    scope
  };
}

export const calculateVersionScores = (
  version: PlanVersion,
  options: ScoreEngineOptions = {}
): { scores: VersionScores; breakdown: ScoreBreakdown } => {
  const context = buildScoringContext(version, options);
  const normalizedWeights = normalizeGoalWeights(context.programGoals.weights);

  const area = scoreAreaEfficiency(context);
  const circulation = scoreCirculation(context);
  const daylight = scoreDaylight(context);
  const wetCore = scoreWetCore(context);
  const egress = scoreEgress(context);
  const structureFit = scoreStructureFit(context);

  const complianceContext = buildComplianceContext(version, context.rulePack, {
    buildingType: options.projectType ?? options.program?.projectType ?? "healthcare",
    scoringConfig: options.scoringConfig
  });
  const complianceResults = filterComplianceResultsForScope(
    runComplianceCheck(complianceContext),
    context
  );
  const validationErrors = (context.issues ?? []).filter((issue) => issue.severity === "error").length;
  const riskCount = computeRiskCount(complianceResults, validationErrors);

  const scores: VersionScores = {
    areaEfficiency: area.score,
    circulationScore: circulation.score,
    daylightScore: daylight.score,
    mepAlignmentScore: wetCore.score,
    egressScore: egress.score,
    structureFitScore: structureFit.score,
    riskCount
  };

  const metrics: MetricContribution[] = [
    buildMetricContribution(area, "area_efficiency", "Area efficiency", normalizedWeights.areaEfficiency),
    buildMetricContribution(circulation, "circulation", "Circulation", normalizedWeights.circulation),
    buildMetricContribution(daylight, "daylight", "Daylight", normalizedWeights.daylight),
    buildMetricContribution(wetCore, "wet_core", "Wet core / MEP", normalizedWeights.wetCore),
    buildMetricContribution(egress, "egress", "Egress", normalizedWeights.egress),
    buildMetricContribution(structureFit, "structure_fit", "Structure fit", normalizedWeights.structureFit)
  ].filter((metric) => metric.weight > 0);

  const comparisonHints = [
    ...[area, circulation, daylight, wetCore, egress, structureFit].flatMap((metric) => metric.hints ?? []),
    riskCount > 0 ? `${riskCount} compliance or validation risk(s) reduce total score.` : ""
  ].filter(Boolean);

  const breakdown: ScoreBreakdown = {
    rulePackId: context.rulePack.id,
    programGoalsId: context.programGoals.id,
    totalScore: computeTotalScore(scores, context.programGoals),
    metrics,
    comparisonHints
  };

  return {
    scores: {
      ...scores,
      breakdown
    },
    breakdown
  };
};

export function calculateVersionScoresByLevel(
  version: PlanVersion,
  options: Omit<ScoreEngineOptions, "levelId" | "scope"> = {}
): Record<string, { scores: VersionScores; breakdown: ScoreBreakdown }> {
  return version.levels.reduce<Record<string, { scores: VersionScores; breakdown: ScoreBreakdown }>>((acc, level) => {
    acc[level.id] = calculateVersionScores(version, {
      ...options,
      levelId: level.id,
      scope: "level"
    });
    return acc;
  }, {});
}

export function calculateVersionScoresByFloorGroup(
  version: PlanVersion,
  options: Omit<ScoreEngineOptions, "standardFloorGroupId" | "scope"> = {}
): Record<string, { scores: VersionScores; breakdown: ScoreBreakdown }> {
  const groups = version.standardFloorGroups ?? [];

  return groups.reduce<Record<string, { scores: VersionScores; breakdown: ScoreBreakdown }>>((acc, group) => {
    acc[group.id] = calculateVersionScores(version, {
      ...options,
      standardFloorGroupId: group.id,
      scope: "floor_group"
    });
    return acc;
  }, {});
}
