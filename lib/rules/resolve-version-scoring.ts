import type { CodeContext, ProgramModel, ProjectDomain } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";
import { calculateVersionScores } from "@/lib/rules/score-engine";
import { resolveProgramGoals } from "@/lib/rules/program-goals";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import { getCodeContext } from "@/lib/project-domain";
import { validatePlanVersion, type PlanValidationIssue } from "@/lib/plan-validation";

export interface VersionScoringInput {
  codeContext?: CodeContext;
  program?: ProgramModel;
  projectType?: string;
  orientationDeg?: number;
}

export function scoringInputFromDomain(domain?: ProjectDomain, projectType?: string): VersionScoringInput {
  return {
    codeContext: getCodeContext(domain),
    program: domain?.program,
    projectType: projectType ?? domain?.program.projectType,
    orientationDeg: domain?.site.orientationDeg
  };
}

export function scoreVersionWithContext(
  version: PlanVersion,
  input: VersionScoringInput = {},
  issues?: PlanValidationIssue[]
) {
  const resolvedIssues =
    issues ??
    validatePlanVersion(version, {
      codeContext: input.codeContext,
      projectType: input.projectType
    }).issues;

  return calculateVersionScores(version, {
    ...input,
    issues: resolvedIssues,
    rulePack: resolveRulePack({ codeContext: input.codeContext, projectType: input.projectType }),
    programGoals: resolveProgramGoals(
      input.program ?? (input.projectType ? ({ projectType: input.projectType } as ProgramModel) : undefined)
    )
  });
}

export function ensureVersionScores(version: PlanVersion, input: VersionScoringInput = {}): PlanVersion {
  if (version.scores?.breakdown) {
    return version;
  }

  const { scores } = scoreVersionWithContext(version, input);
  return { ...version, scores };
}
