import { describe, expect, it } from "vitest";
import { computeAnalysis } from "@/lib/analysis-engine";
import { initialProjectData } from "@/lib/evolab-data";

const baseVersion = initialProjectData.versions[0]!;

describe("analysis egress diagnostics", () => {
  it("returns egress diagnostics and summary for canvas legend", () => {
    const analysis = computeAnalysis(baseVersion, ["egress_path", "egress_distance"], {
      projectType: "healthcare"
    });

    expect(analysis.egressDiagnostics.length).toBeGreaterThan(0);
    expect(analysis.egressSummary).toBeDefined();
    expect(analysis.egressSummary?.validCount).toBeGreaterThan(0);
    expect(analysis.egressPaths[0]?.missingLinks).toBeDefined();
  });
});
