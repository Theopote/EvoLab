import type { CodeContext, ProgramModel, ProjectDomain } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";
import { calculateVersionScores } from "@/lib/rules/score-engine";
import { resolveProgramGoalsFromContext } from "@/lib/rules/program-goals";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import { resolveScoringContext } from "@/lib/rules/scoring-config";
import { validatePlanVersion, type PlanValidationIssue } from "@/lib/plan-validation";
import type { ProgramGoals, RulePack } from "@/lib/rules/types";

export interface VersionScoringInput {
  codeContext?: CodeContext;
  program?: ProgramModel;
  projectType?: string;
  orientationDeg?: number;
  rulePack?: RulePack;
  programGoals?: ProgramGoals;
}

export function scoringInputFromDomain(domain?: ProjectDomain, projectType?: string): VersionScoringInput {
  const resolved = resolveScoringContext(domain, projectType);

  return {
    codeContext: resolved.codeContext,
    program: domain?.program,
    projectType: projectType ?? domain?.program.projectType,
    orientationDeg: domain?.site.orientationDeg,
    rulePack: resolved.rulePack,
    programGoals: resolved.programGoals
  };
}

export function scoreVersionWithContext(
  version: PlanVersion,
  input: VersionScoringInput = {},
  issues?: PlanValidationIssue[]
) {
  const rulePack =
    input.rulePack ?? resolveRulePack({ codeContext: input.codeContext, projectType: input.projectType });
  const programGoals =
    input.programGoals ??
    resolveProgramGoalsFromContext({
      program: input.program,
      projectType: input.projectType
    });
  const codeContext = input.codeContext ?? rulePack;

  const resolvedIssues =
    issues ??
    validatePlanVersion(version, {
      codeContext,
      projectType: input.projectType,
      rulePack
    }).issues;

  return calculateVersionScores(version, {
    ...input,
    codeContext,
    issues: resolvedIssues,
    rulePack,
    programGoals
  });
}

export function rescoreVersion(version: PlanVersion, input: VersionScoringInput = {}): PlanVersion {
  const { scores } = scoreVersionWithContext(version, input);
  return { ...version, scores };
}

export function ensureVersionScores(version: PlanVersion, input: VersionScoringInput = {}, force = false): PlanVersion {
  if (!force && version.scores?.breakdown) {
    return version;
  }

  return rescoreVersion(version, input);
}

export function rescoreVersions(versions: PlanVersion[], input: VersionScoringInput = {}): PlanVersion[] {
  return versions.map((version) => rescoreVersion(version, input));
}
