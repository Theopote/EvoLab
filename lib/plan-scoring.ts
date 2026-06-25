import type { CodeContext, ProgramModel } from "@/lib/building-domain";
import type { PlanVersion, VersionScores } from "@/lib/project-types";
import {
  calculateVersionScores,
  calculateVersionScoresByFloorGroup,
  calculateVersionScoresByLevel
} from "@/lib/rules/score-engine";
import type { ScoreBreakdown } from "@/lib/rules/types";
import type { PlanValidationIssue } from "@/lib/plan-validation";
import type { PlanScopeKind } from "@/lib/plan-scope";

export interface CalculateScoresOptions {
  issues?: PlanValidationIssue[];
  codeContext?: CodeContext;
  program?: ProgramModel;
  projectType?: string;
  orientationDeg?: number;
  levelId?: string;
  standardFloorGroupId?: string;
  scope?: PlanScopeKind;
}

export function calculateScores(
  version: PlanVersion,
  issues: PlanValidationIssue[] = [],
  options: Omit<CalculateScoresOptions, "issues"> = {}
): VersionScores {
  return calculateVersionScores(version, {
    ...options,
    issues
  }).scores;
}

export function calculateScoresWithBreakdown(
  version: PlanVersion,
  issues: PlanValidationIssue[] = [],
  options: Omit<CalculateScoresOptions, "issues"> = {}
): { scores: VersionScores; breakdown: ScoreBreakdown } {
  return calculateVersionScores(version, {
    ...options,
    issues
  });
}

export { calculateVersionScoresByFloorGroup, calculateVersionScoresByLevel };
