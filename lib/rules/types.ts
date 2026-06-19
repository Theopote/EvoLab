import type { PlanScopeKind } from "@/lib/plan-scope";
import type { CodeContext } from "@/lib/building-domain";
import type { ProgramModel } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";
import type { PlanValidationIssue } from "@/lib/plan-validation";

export type ScoreMetricId =
  | "area_efficiency"
  | "circulation"
  | "daylight"
  | "wet_core"
  | "egress"
  | "structure_fit"
  | "risk";

export interface MetricEvidence {
  label: string;
  value: string;
  impact?: "positive" | "negative" | "neutral";
}

export interface MetricContribution {
  id: ScoreMetricId;
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  summary: string;
  evidence: MetricEvidence[];
}

export interface ScoreBreakdown {
  rulePackId: string;
  programGoalsId: string;
  totalScore: number;
  metrics: MetricContribution[];
  comparisonHints: string[];
}

export interface ScoringThresholds {
  circulationTargetRatio: number;
  circulationTolerance: number;
  plumbingMaxDistanceM: number;
  egressMaxDistanceM: number;
  daylightMaxDepthM: number;
  areaEfficiencyFactor: number;
}

export interface RulePack extends CodeContext {
  scoring: ScoringThresholds;
}

export interface ProgramGoalWeights {
  areaEfficiency: number;
  circulation: number;
  daylight: number;
  wetCore: number;
  egress: number;
  structureFit: number;
  riskPenalty: number;
}

export interface ProgramGoals {
  id: string;
  label: string;
  projectType: string;
  weights: ProgramGoalWeights;
}

export interface ScoringContext {
  version: PlanVersion;
  issues?: PlanValidationIssue[];
  rulePack: RulePack;
  programGoals: ProgramGoals;
  orientationDeg?: number;
  levelId?: string;
  scope?: PlanScopeKind;
}

export interface MetricResult {
  score: number;
  summary: string;
  evidence: MetricEvidence[];
  hints?: string[];
  riskCount?: number;
}
