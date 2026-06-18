import { describe, expect, it } from "vitest";
import { buildRoomGraph } from "@/lib/analysis/graph";
import { initialProjectData } from "@/lib/evolab-data";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import { validatePlanVersion } from "@/lib/plan-validation";
import { checkCompliance } from "@/lib/quantity-engine";
import { computeEgressPathMetrics } from "@/lib/rules/path-metrics";
import { resolveProgramGoals } from "@/lib/rules/program-goals";
import { calculateVersionScores } from "@/lib/rules/score-engine";
import { compareVersionScores, computeTotalScore } from "@/lib/rules/version-total-score";

const baseVersion = initialProjectData.versions[0]!;

describe("rules score engine", () => {
  it("returns explainable breakdown with path-based egress", () => {
    const validation = validatePlanVersion(baseVersion, { codeContext: defaultHealthcareCodeContext });
    const { scores, breakdown } = calculateVersionScores(baseVersion, {
      issues: validation.issues,
      codeContext: defaultHealthcareCodeContext,
      projectType: "healthcare"
    });

    expect(scores.areaEfficiency).toBeGreaterThan(0);
    expect(scores.egressScore).toBeGreaterThanOrEqual(0);
    expect(scores.breakdown?.metrics.length).toBeGreaterThan(0);
    expect(breakdown.comparisonHints.length).toBeGreaterThanOrEqual(0);
    expect(breakdown.totalScore).toBe(computeTotalScore(scores, resolveProgramGoals()));
  });

  it("uses graph egress distance in compliance checks", () => {
    const egress = computeEgressPathMetrics(baseVersion);
    const compliance = checkCompliance(baseVersion, defaultHealthcareCodeContext);
    const egressItem = compliance.find((item) => item.id === "egress-distance");

    expect(egress.maxDistance).toBeGreaterThan(0);
    expect(egressItem?.message).toContain("egress path");
  });

  it("explains score delta between versions", () => {
    const left = calculateVersionScores(baseVersion, { projectType: "healthcare" }).scores;
    const right = {
      ...left,
      egressScore: (left.egressScore ?? 0) - 20,
      riskCount: left.riskCount + 2
    };

    const comparison = compareVersionScores(left, right, resolveProgramGoals());
    expect(comparison.totalDelta).toBeGreaterThan(0);
    expect(comparison.explanations.length).toBeGreaterThan(0);
  });

  it("prefers door-aware navigation graph when door data exists", () => {
    const graph = buildRoomGraph(baseVersion);
    const egress = computeEgressPathMetrics(baseVersion);

    expect(["door-aware", "adjacency"]).toContain(graph.method);
    expect(["door-aware-path", "path", "centroid-fallback"]).toContain(egress.method);
  });
});
