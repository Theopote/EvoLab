import { describe, expect, it } from "vitest";
import { buildPathGraph } from "@/lib/analysis/path-graph";
import { buildRoomGraph } from "@/lib/analysis/graph";
import { initialProjectData } from "@/lib/evolab-data";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import { validatePlanVersion } from "@/lib/plan-validation";
import { checkCompliance } from "@/lib/quantity-engine";
import { computeEgressPathMetrics, computeWetCorePathMetrics, computeWetCoreVerticalMetrics } from "@/lib/rules/path-metrics";
import { resolveProgramGoalsFromContext } from "@/lib/rules/program-goals";
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
    expect(scores.structureFitScore).toBeGreaterThan(0);
    expect(scores.breakdown?.metrics.length).toBeGreaterThan(0);
    expect(breakdown.comparisonHints.length).toBeGreaterThanOrEqual(0);
    expect(breakdown.totalScore).toBe(
      computeTotalScore(scores, resolveProgramGoalsFromContext({ projectType: "healthcare" }))
    );
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

    const comparison = compareVersionScores(
      left,
      right,
      resolveProgramGoalsFromContext({ projectType: "healthcare" })
    );
    expect(comparison.totalDelta).toBeGreaterThan(0);
    expect(comparison.explanations.length).toBeGreaterThan(0);
  });

  it("prefers opening-aware navigation graph when door portals exist", () => {
    const pathGraph = buildPathGraph(baseVersion);
    const roomGraph = buildRoomGraph(baseVersion);
    const egress = computeEgressPathMetrics(baseVersion);
    const portalNodes = [...pathGraph.nodes.values()].filter((node) => node.kind === "portal");

    expect(portalNodes.length).toBeGreaterThan(0);
    expect(["opening-aware", "door-aware", "adjacency"]).toContain(pathGraph.method);
    expect(["opening-aware", "door-aware", "adjacency"]).toContain(roomGraph.method);
    expect(["opening-aware-path", "door-aware-path", "path", "centroid-fallback"]).toContain(egress.method);
  });

  it("scores wet-core vertical alignment and shaft capacity", () => {
    const wetCore = computeWetCorePathMetrics(baseVersion);
    const vertical = computeWetCoreVerticalMetrics(baseVersion);

    expect(wetCore.vertical.stackGroups).toBeGreaterThan(0);
    expect(vertical.shaftAreaSqm).toBeGreaterThan(0);
    expect(vertical.wetDemandSqm).toBeGreaterThan(0);
    expect(vertical.shaftCapacityRatio).toBeGreaterThan(0);
  });

  it("includes structure-fit evidence from structural grid", () => {
    const { breakdown } = calculateVersionScores(baseVersion, { projectType: "healthcare" });
    const structureMetric = breakdown.metrics.find((metric) => metric.id === "structure_fit");

    expect(structureMetric).toBeDefined();
    expect(structureMetric?.evidence.some((item) => item.label.includes("Grid") || item.label.includes("Core"))).toBe(true);
  });
});
