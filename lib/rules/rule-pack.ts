import type { CodeContext } from "@/lib/building-domain";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import type { RulePack, ScoringThresholds } from "@/lib/rules/types";

const defaultScoringThresholds: ScoringThresholds = {
  circulationTargetRatio: 0.18,
  circulationTolerance: 0.18,
  plumbingMaxDistanceM: 12,
  egressMaxDistanceM: 30,
  daylightMaxDepthM: 8,
  areaEfficiencyFactor: 92
};

const officeScoringThresholds: ScoringThresholds = {
  circulationTargetRatio: 0.16,
  circulationTolerance: 0.16,
  plumbingMaxDistanceM: 10,
  egressMaxDistanceM: 35,
  daylightMaxDepthM: 10,
  areaEfficiencyFactor: 94
};

const residentialScoringThresholds: ScoringThresholds = {
  circulationTargetRatio: 0.12,
  circulationTolerance: 0.14,
  plumbingMaxDistanceM: 8,
  egressMaxDistanceM: 25,
  daylightMaxDepthM: 6,
  areaEfficiencyFactor: 90
};

const schoolScoringThresholds: ScoringThresholds = {
  circulationTargetRatio: 0.17,
  circulationTolerance: 0.16,
  plumbingMaxDistanceM: 10,
  egressMaxDistanceM: 28,
  daylightMaxDepthM: 7,
  areaEfficiencyFactor: 91
};

export const defaultHealthcareRulePack: RulePack = {
  ...defaultHealthcareCodeContext,
  scoring: defaultScoringThresholds
};

export const officeRulePack: RulePack = {
  id: "code-office-generic",
  label: "Office Early Design",
  region: "generic",
  rules: [
    {
      id: "corridor-width",
      category: "circulation",
      title: "Corridor clear width",
      basis: "Corridor clear width should not be less than 1.5m.",
      threshold: 1.5,
      unit: "m",
      comparator: "gte"
    },
    {
      id: "egress-distance",
      category: "egress",
      title: "Egress travel distance",
      basis: "Egress travel distance should not exceed 35m.",
      threshold: 35,
      unit: "m",
      comparator: "lte"
    },
    {
      id: "stair-count",
      category: "core",
      title: "Vertical core count",
      basis: "At least one stair or elevator core should exist.",
      threshold: 1,
      comparator: "gte"
    }
  ],
  scoring: officeScoringThresholds
};

export const residentialRulePack: RulePack = {
  id: "code-residential-generic",
  label: "Residential Early Design",
  region: "generic",
  rules: [
    {
      id: "corridor-width",
      category: "circulation",
      title: "Corridor clear width",
      basis: "Corridor clear width should not be less than 1.1m.",
      threshold: 1.1,
      unit: "m",
      comparator: "gte"
    },
    {
      id: "egress-distance",
      category: "egress",
      title: "Egress travel distance",
      basis: "Egress travel distance should not exceed 25m.",
      threshold: 25,
      unit: "m",
      comparator: "lte"
    },
    {
      id: "stair-count",
      category: "core",
      title: "Vertical core count",
      basis: "At least one stair core should exist.",
      threshold: 1,
      comparator: "gte"
    }
  ],
  scoring: residentialScoringThresholds
};

export const schoolRulePack: RulePack = {
  id: "code-school-generic",
  label: "School Early Design",
  region: "generic",
  rules: [
    {
      id: "corridor-width",
      category: "circulation",
      title: "Corridor clear width",
      basis: "Corridor clear width should not be less than 1.8m.",
      threshold: 1.8,
      unit: "m",
      comparator: "gte"
    },
    {
      id: "egress-distance",
      category: "egress",
      title: "Egress travel distance",
      basis: "Egress travel distance should not exceed 28m.",
      threshold: 28,
      unit: "m",
      comparator: "lte"
    },
    {
      id: "stair-count",
      category: "core",
      title: "Vertical core count",
      basis: "At least one stair core should exist.",
      threshold: 1,
      comparator: "gte"
    }
  ],
  scoring: schoolScoringThresholds
};

const rulePacksByProjectType: Record<string, RulePack> = {
  healthcare: defaultHealthcareRulePack,
  hospital: defaultHealthcareRulePack,
  clinic: defaultHealthcareRulePack,
  office: officeRulePack,
  commercial: officeRulePack,
  residential: residentialRulePack,
  apartment: residentialRulePack,
  housing: residentialRulePack,
  school: schoolRulePack,
  education: schoolRulePack
};

export function ruleThreshold(rulePack: RulePack, ruleId: string, fallback: number) {
  return rulePack.rules.find((rule) => rule.id === ruleId)?.threshold ?? fallback;
}

export function ruleBasis(rulePack: RulePack, ruleId: string, fallback: string) {
  return rulePack.rules.find((rule) => rule.id === ruleId)?.basis ?? fallback;
}

export function resolveRulePack(options?: { codeContext?: CodeContext; projectType?: string }): RulePack {
  const projectType = options?.projectType?.toLowerCase().trim() ?? "";
  const preset = rulePacksByProjectType[projectType];

  if (!options?.codeContext) {
    return preset ?? defaultHealthcareRulePack;
  }

  const baseScoring = preset?.scoring ?? defaultScoringThresholds;

  return {
    ...options.codeContext,
    scoring: {
      ...baseScoring,
      egressMaxDistanceM: ruleThreshold(
        { ...defaultHealthcareRulePack, ...options.codeContext, scoring: baseScoring },
        "egress-distance",
        baseScoring.egressMaxDistanceM
      )
    }
  };
}

export function codeContextFromRulePack(rulePack: RulePack): CodeContext {
  return {
    id: rulePack.id,
    label: rulePack.label,
    region: rulePack.region,
    rules: rulePack.rules
  };
}
