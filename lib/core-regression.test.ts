import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { calculateQuantities } from "@/lib/quantity-engine";
import { validatePlanVersion } from "@/lib/plan-validation";
import { calculateVersionScores } from "@/lib/rules/score-engine";

const baseVersion = initialProjectData.versions[0]!;

function quantityRegressionSnapshot(version: typeof baseVersion, scope: "building" | "level") {
  const quantities =
    scope === "building"
      ? calculateQuantities(version, { scope: "building" })
      : calculateQuantities(version, { levelId: version.levels[0]?.id, scope: "level" });

  return {
    scope,
    summary: quantities.summary,
    rowIds: quantities.rows.map((row) => row.id).sort()
  };
}

function validationRegressionSnapshot(version: typeof baseVersion) {
  const result = validatePlanVersion(version);

  return {
    valid: result.valid,
    issueIds: [...new Set(result.issues.map((issue) => issue.id))].sort(),
    errorCount: result.issues.filter((issue) => issue.severity === "error").length,
    warningCount: result.issues.filter((issue) => issue.severity === "warning").length
  };
}

function scoreRegressionSnapshot(version: typeof baseVersion) {
  const { scores, breakdown } = calculateVersionScores(version, {
    scope: "building",
    projectType: initialProjectData.projectType
  });

  return {
    totalScore: breakdown.totalScore,
    areaEfficiency: scores.areaEfficiency,
    circulationScore: scores.circulationScore,
    daylightScore: scores.daylightScore,
    mepAlignmentScore: scores.mepAlignmentScore,
    egressScore: scores.egressScore,
    structureFitScore: scores.structureFitScore,
    riskCount: scores.riskCount,
    metricIds: breakdown.metrics.map((metric) => metric.id).sort()
  };
}

describe("core regression snapshots", () => {
  it("matches building quantity summary for the seed demo scheme", () => {
    expect(quantityRegressionSnapshot(baseVersion, "building")).toMatchSnapshot();
  });

  it("matches level quantity summary for the seed demo scheme", () => {
    expect(quantityRegressionSnapshot(baseVersion, "level")).toMatchSnapshot();
  });

  it("matches validation issue rollup for the seed demo scheme", () => {
    expect(validationRegressionSnapshot(baseVersion)).toMatchSnapshot();
  });

  it("matches building score rollup for the seed demo scheme", () => {
    expect(scoreRegressionSnapshot(baseVersion)).toMatchSnapshot();
  });

  it("matches multi-floor building quantity summary", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    expect(quantityRegressionSnapshot(expanded, "building")).toMatchSnapshot();
  });
});
