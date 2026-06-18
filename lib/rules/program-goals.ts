import type { ProgramModel } from "@/lib/building-domain";
import type { ProgramGoals, ProgramGoalWeights } from "@/lib/rules/types";

const defaultWeights: ProgramGoalWeights = {
  areaEfficiency: 0.28,
  circulation: 0.26,
  daylight: 0.2,
  wetCore: 0.18,
  egress: 0,
  structureFit: 0,
  riskPenalty: 4
};

const healthcareWeights: ProgramGoalWeights = {
  areaEfficiency: 0.22,
  circulation: 0.22,
  daylight: 0.18,
  wetCore: 0.16,
  egress: 0.14,
  structureFit: 0.08,
  riskPenalty: 4
};

const officeWeights: ProgramGoalWeights = {
  areaEfficiency: 0.34,
  circulation: 0.2,
  daylight: 0.22,
  wetCore: 0.1,
  egress: 0.08,
  structureFit: 0.06,
  riskPenalty: 3
};

const residentialWeights: ProgramGoalWeights = {
  areaEfficiency: 0.24,
  circulation: 0.14,
  daylight: 0.28,
  wetCore: 0.12,
  egress: 0.12,
  structureFit: 0.1,
  riskPenalty: 3
};

const schoolWeights: ProgramGoalWeights = {
  areaEfficiency: 0.2,
  circulation: 0.24,
  daylight: 0.22,
  wetCore: 0.1,
  egress: 0.16,
  structureFit: 0.08,
  riskPenalty: 4
};

const goalsByProjectType: Record<string, ProgramGoals> = {
  healthcare: {
    id: "goals-healthcare",
    label: "Healthcare priorities",
    projectType: "healthcare",
    weights: healthcareWeights
  },
  hospital: {
    id: "goals-healthcare",
    label: "Healthcare priorities",
    projectType: "hospital",
    weights: healthcareWeights
  },
  clinic: {
    id: "goals-healthcare",
    label: "Healthcare priorities",
    projectType: "clinic",
    weights: healthcareWeights
  },
  office: {
    id: "goals-office",
    label: "Office priorities",
    projectType: "office",
    weights: officeWeights
  },
  commercial: {
    id: "goals-office",
    label: "Office priorities",
    projectType: "commercial",
    weights: officeWeights
  },
  residential: {
    id: "goals-residential",
    label: "Residential priorities",
    projectType: "residential",
    weights: residentialWeights
  },
  apartment: {
    id: "goals-residential",
    label: "Residential priorities",
    projectType: "apartment",
    weights: residentialWeights
  },
  housing: {
    id: "goals-residential",
    label: "Residential priorities",
    projectType: "housing",
    weights: residentialWeights
  },
  school: {
    id: "goals-school",
    label: "School priorities",
    projectType: "school",
    weights: schoolWeights
  },
  education: {
    id: "goals-school",
    label: "School priorities",
    projectType: "education",
    weights: schoolWeights
  }
};

export const defaultProgramGoals: ProgramGoals = {
  id: "goals-default",
  label: "Balanced priorities",
  projectType: "generic",
  weights: defaultWeights
};

export function resolveProgramGoals(program?: ProgramModel): ProgramGoals {
  const projectType = program?.projectType?.toLowerCase().trim() ?? "";
  return goalsByProjectType[projectType] ?? defaultProgramGoals;
}

export function resolveProgramGoalsFromContext(options?: { program?: ProgramModel; projectType?: string }): ProgramGoals {
  const projectType = options?.program?.projectType ?? options?.projectType;
  return resolveProgramGoals(projectType ? ({ projectType } as ProgramModel) : options?.program);
}

export function normalizeGoalWeights(weights: ProgramGoalWeights): ProgramGoalWeights {
  const scoreWeightTotal =
    weights.areaEfficiency +
    weights.circulation +
    weights.daylight +
    weights.wetCore +
    weights.egress +
    weights.structureFit;

  if (scoreWeightTotal <= 0) {
    return defaultWeights;
  }

  return {
    areaEfficiency: weights.areaEfficiency / scoreWeightTotal,
    circulation: weights.circulation / scoreWeightTotal,
    daylight: weights.daylight / scoreWeightTotal,
    wetCore: weights.wetCore / scoreWeightTotal,
    egress: weights.egress / scoreWeightTotal,
    structureFit: weights.structureFit / scoreWeightTotal,
    riskPenalty: weights.riskPenalty
  };
}
