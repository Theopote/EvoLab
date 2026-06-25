import type { CodeContext, ScoringConfig } from "@/lib/building-domain";
import type { ProjectDomain } from "@/lib/building-domain";
import {
  defaultProgramGoals,
  normalizeGoalWeights,
  resolveProgramGoalsFromContext
} from "@/lib/rules/program-goals";
import {
  codeContextFromRulePack,
  defaultHealthcareRulePack,
  officeRulePack,
  residentialRulePack,
  schoolRulePack,
  resolveRulePack
} from "@/lib/rules/rule-pack";
import { resolveTypologyPack, resolveTypologyPackId } from "@/lib/typology/resolve";
import { resolveEgressWidthConfig } from "@/lib/compliance-rules";
import type { ProgramGoals, ProgramGoalWeights, RulePack, ScoringThresholds } from "@/lib/rules/types";

export type RulePackPresetId = NonNullable<ScoringConfig["rulePackPreset"]>;
export type ProgramGoalsPresetId = NonNullable<ScoringConfig["programGoalsPreset"]>;

export const RULE_PACK_PRESET_OPTIONS: Array<{ id: RulePackPresetId; label: string; description: string }> = [
  { id: "healthcare", label: "Healthcare", description: "Clinical circulation, egress, and MEP thresholds." },
  { id: "office", label: "Office", description: "Higher egress tolerance and wider corridors." },
  { id: "residential", label: "Residential", description: "Tighter plumbing reach and daylight depth." },
  { id: "school", label: "School", description: "Wide corridors and egress-focused school thresholds." }
];

export const PROGRAM_GOALS_PRESET_OPTIONS: Array<{ id: ProgramGoalsPresetId; label: string; description: string }> = [
  { id: "healthcare", label: "Healthcare", description: "Balanced clinical priorities with egress weight." },
  { id: "office", label: "Office", description: "Area and daylight focused." },
  { id: "residential", label: "Residential", description: "Daylight and egress focused." },
  { id: "school", label: "School", description: "Circulation and egress focused." },
  { id: "balanced", label: "Balanced", description: "Generic early-design weighting." }
];

export const SCORING_THRESHOLD_FIELDS: Array<{
  key: keyof ScoringThresholds;
  label: string;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}> = [
  { key: "circulationTargetRatio", label: "Circulation target", step: 0.01, min: 0.08, max: 0.3 },
  { key: "circulationTolerance", label: "Circulation tolerance", step: 0.01, min: 0.08, max: 0.3 },
  { key: "plumbingMaxDistanceM", label: "Plumbing max distance", unit: "m", step: 0.5, min: 4, max: 20 },
  { key: "egressMaxDistanceM", label: "Egress max distance", unit: "m", step: 1, min: 15, max: 50 },
  { key: "daylightMaxDepthM", label: "Daylight max depth", unit: "m", step: 0.5, min: 4, max: 14 },
  { key: "areaEfficiencyFactor", label: "Area efficiency factor", step: 1, min: 80, max: 100 }
];

export const GOAL_WEIGHT_FIELDS: Array<{ key: keyof ProgramGoalWeights; label: string; normalized?: boolean }> = [
  { key: "areaEfficiency", label: "Area efficiency", normalized: true },
  { key: "circulation", label: "Circulation", normalized: true },
  { key: "daylight", label: "Daylight", normalized: true },
  { key: "wetCore", label: "Wet core / MEP", normalized: true },
  { key: "egress", label: "Egress", normalized: true },
  { key: "structureFit", label: "Structure fit", normalized: true },
  { key: "riskPenalty", label: "Risk penalty", normalized: false }
];

export const COMPLIANCE_RULE_FIELDS: Array<{ key: "corridor-width" | "egress-distance" | "stair-count"; label: string; unit?: string }> =
  [
    { key: "corridor-width", label: "Corridor clear width", unit: "m" },
    { key: "egress-distance", label: "Egress travel distance", unit: "m" },
    { key: "stair-count", label: "Vertical core count" }
  ];

export const EGRESS_WIDTH_FIELDS: Array<{
  key: "widthPer100PersonsM" | "areaPerOccupantSqm";
  label: string;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
}> = [
  { key: "widthPer100PersonsM", label: "Stair width per 100 persons", unit: "m", step: 0.05, min: 0.5, max: 1.5 },
  { key: "areaPerOccupantSqm", label: "Occupiable area per person", unit: "sqm", step: 1, min: 2, max: 30 }
];

const rulePackByPreset: Record<RulePackPresetId, RulePack> = {
  healthcare: defaultHealthcareRulePack,
  office: officeRulePack,
  residential: residentialRulePack,
  school: schoolRulePack
};

function inferPresetId(domain?: ProjectDomain, projectType?: string): RulePackPresetId {
  const configured = domain?.scoringConfig?.rulePackPreset;
  if (configured) {
    return configured;
  }

  return resolveTypologyPackId(projectType ?? domain?.program.projectType);
}

function inferGoalsPresetId(domain?: ProjectDomain, projectType?: string): ProgramGoalsPresetId {
  const configured = domain?.scoringConfig?.programGoalsPreset;
  if (configured) {
    return configured;
  }

  return resolveTypologyPackId(projectType ?? domain?.program.projectType);
}

function applyRuleThresholdOverrides(rulePack: RulePack, overrides?: ScoringConfig["ruleThresholds"]): RulePack {
  if (!overrides) {
    return rulePack;
  }

  const rules = rulePack.rules.map((rule) => {
    const override = overrides[rule.id as keyof NonNullable<ScoringConfig["ruleThresholds"]>];
    return override === undefined ? rule : { ...rule, threshold: override };
  });

  const nextScoring = { ...rulePack.scoring };
  if (overrides["egress-distance"] !== undefined) {
    nextScoring.egressMaxDistanceM = overrides["egress-distance"];
  }

  return {
    ...rulePack,
    rules,
    scoring: nextScoring
  };
}

export function createDefaultScoringConfig(projectType?: string): ScoringConfig {
  return {
    rulePackPreset: inferPresetId(undefined, projectType),
    programGoalsPreset: inferGoalsPresetId(undefined, projectType)
  };
}

export function normalizeScoringConfig(config: ScoringConfig | undefined, projectType?: string): ScoringConfig {
  const defaults = createDefaultScoringConfig(projectType);
  const egressDefaults = resolveEgressWidthConfig(projectType ?? "healthcare");

  return {
    ...defaults,
    ...config,
    scoringThresholds: config?.scoringThresholds ? { ...config.scoringThresholds } : undefined,
    goalWeights: config?.goalWeights ? { ...config.goalWeights } : undefined,
    ruleThresholds: config?.ruleThresholds ? { ...config.ruleThresholds } : undefined,
    egressWidth: {
      widthPer100PersonsM: config?.egressWidth?.widthPer100PersonsM ?? egressDefaults.widthPer100PersonsM,
      areaPerOccupantSqm: config?.egressWidth?.areaPerOccupantSqm ?? egressDefaults.areaPerOccupantSqm,
      notice: config?.egressWidth?.notice ?? egressDefaults.notice
    }
  };
}

export function resolveRulePackFromDomain(domain?: ProjectDomain, projectType?: string): RulePack {
  const config = normalizeScoringConfig(domain?.scoringConfig, projectType ?? domain?.program.projectType);
  const presetId = config.rulePackPreset ?? inferPresetId(domain, projectType);
  const typologyPack = resolveTypologyPack(projectType ?? domain?.program.projectType);
  const preset = rulePackByPreset[presetId] ?? typologyPack.rulePack;

  let rulePack: RulePack = {
    ...preset,
    scoring: {
      ...preset.scoring,
      ...(config.scoringThresholds as Partial<ScoringThresholds> | undefined)
    }
  };

  if (domain?.codeContext) {
    rulePack = {
      ...rulePack,
      id: domain.codeContext.id,
      label: domain.codeContext.label,
      region: domain.codeContext.region,
      rules: domain.codeContext.rules
    };
  }

  return applyRuleThresholdOverrides(rulePack, config.ruleThresholds);
}

export function resolveProgramGoalsFromDomain(domain?: ProjectDomain, projectType?: string): ProgramGoals {
  const config = normalizeScoringConfig(domain?.scoringConfig, projectType ?? domain?.program.projectType);
  const presetId = config.programGoalsPreset ?? inferGoalsPresetId(domain, projectType);
  const baseGoals =
    presetId === "balanced"
      ? defaultProgramGoals
      : resolveProgramGoalsFromContext({
          projectType: presetId === "healthcare" ? "healthcare" : presetId
        }) ?? resolveTypologyPack(projectType ?? domain?.program.projectType).programGoals;

  if (!config.goalWeights) {
    return baseGoals;
  }

  return {
    ...baseGoals,
    id: `${baseGoals.id}-custom`,
    label: `${baseGoals.label} (custom)`,
    weights: {
      ...baseGoals.weights,
      ...(config.goalWeights as Partial<ProgramGoalWeights>)
    }
  };
}

export function resolveScoringContext(domain?: ProjectDomain, projectType?: string) {
  const rulePack = resolveRulePackFromDomain(domain, projectType);
  const programGoals = resolveProgramGoalsFromDomain(domain, projectType);
  const codeContext: CodeContext = codeContextFromRulePack(rulePack);

  return {
    config: normalizeScoringConfig(domain?.scoringConfig, projectType ?? domain?.program.projectType),
    rulePack,
    programGoals,
    codeContext,
    normalizedWeights: normalizeGoalWeights(programGoals.weights)
  };
}

export function previewNormalizedWeights(weights: ProgramGoalWeights) {
  return normalizeGoalWeights(weights);
}
