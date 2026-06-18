import { normalizeGoalWeights, resolveProgramGoals, defaultProgramGoals } from "@/lib/rules/program-goals";
import type { ProgramGoals } from "@/lib/rules/types";
import type { VersionScores } from "@/lib/project-types";

export const computeTotalScore = (scores: VersionScores, goals: ProgramGoals = defaultProgramGoals) => {
  const weights = normalizeGoalWeights(goals.weights);

  return Math.round(
    Math.max(
      0,
      scores.areaEfficiency * weights.areaEfficiency +
        scores.circulationScore * weights.circulation +
        scores.daylightScore * weights.daylight +
        scores.mepAlignmentScore * weights.wetCore +
        (scores.egressScore ?? 0) * weights.egress +
        (scores.structureFitScore ?? 0) * weights.structureFit -
        scores.riskCount * weights.riskPenalty
    )
  );
};

export const compareVersionScores = (left: VersionScores, right: VersionScores, goals?: ProgramGoals) => {
  const resolvedGoals = goals ? normalizeGoalWeights(goals.weights) : normalizeGoalWeights(resolveProgramGoals().weights);
  const deltas = [
    {
      label: "Area efficiency",
      delta: left.areaEfficiency - right.areaEfficiency,
      weight: resolvedGoals.areaEfficiency
    },
    {
      label: "Circulation",
      delta: left.circulationScore - right.circulationScore,
      weight: resolvedGoals.circulation
    },
    {
      label: "Daylight",
      delta: left.daylightScore - right.daylightScore,
      weight: resolvedGoals.daylight
    },
    {
      label: "Wet core / MEP",
      delta: left.mepAlignmentScore - right.mepAlignmentScore,
      weight: resolvedGoals.wetCore
    },
    {
      label: "Egress",
      delta: (left.egressScore ?? 0) - (right.egressScore ?? 0),
      weight: resolvedGoals.egress
    },
    {
      label: "Structure fit",
      delta: (left.structureFitScore ?? 0) - (right.structureFitScore ?? 0),
      weight: resolvedGoals.structureFit
    },
    {
      label: "Risk penalty",
      delta: right.riskCount - left.riskCount,
      weight: resolvedGoals.riskPenalty
    }
  ];

  const explanations = deltas
    .map((item) => ({
      ...item,
      weightedDelta: Math.round(item.delta * item.weight)
    }))
    .filter((item) => item.weightedDelta !== 0)
    .sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta))
    .map((item) => {
      if (item.label === "Risk penalty") {
        return item.delta > 0
          ? `Fewer risks than alternative (${item.delta} fewer warnings/errors).`
          : `More risks than alternative (${Math.abs(item.delta)} extra warnings/errors).`;
      }

      return item.delta > 0
        ? `${item.label} is ${item.delta} points higher (weighted +${item.weightedDelta}).`
        : `${item.label} is ${Math.abs(item.delta)} points lower (weighted ${item.weightedDelta}).`;
    });

  return {
    totalDelta: computeTotalScore(left, goals) - computeTotalScore(right, goals),
    explanations
  };
};
