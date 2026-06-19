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

export interface ScoreEngineOptions {
  issues?: PlanValidationIssue[];
  codeContext?: CodeContext;
  program?: ProgramModel;
  projectType?: string;
  scoringConfig?: ScoringConfig;
  orientationDeg?: number;
  levelId?: string;
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

export const calculateVersionScores = (
  version: PlanVersion,
  options: ScoreEngineOptions = {}
): { scores: VersionScores; breakdown: ScoreBreakdown } => {
  const rulePack = options.rulePack ?? resolveRulePack({ codeContext: options.codeContext, projectType: options.projectType ?? options.program?.projectType });
  const programGoals = options.programGoals ?? resolveProgramGoalsFromContext({
    program: options.program,
    projectType: options.projectType
  });
  const normalizedWeights = normalizeGoalWeights(programGoals.weights);
  const context: ScoringContext = {
    version,
    issues: options.issues,
    rulePack,
    programGoals,
    orientationDeg: options.orientationDeg,
    levelId: options.levelId
  };

  const area = scoreAreaEfficiency(context);
  const circulation = scoreCirculation(context);
  const daylight = scoreDaylight(context);
  const wetCore = scoreWetCore(context);
  const egress = scoreEgress(context);
  const structureFit = scoreStructureFit(context);

  const complianceContext = buildComplianceContext(version, rulePack, {
    buildingType: options.projectType ?? options.program?.projectType ?? "healthcare",
    scoringConfig: options.scoringConfig
  });
  const complianceResults = runComplianceCheck(complianceContext);
  const validationErrors = (options.issues ?? []).filter((issue) => issue.severity === "error").length;
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
    rulePackId: rulePack.id,
    programGoalsId: programGoals.id,
    totalScore: computeTotalScore(scores, programGoals),
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
