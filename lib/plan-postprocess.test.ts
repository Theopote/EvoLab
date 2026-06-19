import { describe, expect, it } from "vitest";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { buildFloorValidationSummary, validatePlanVersion } from "@/lib/plan-validation";

const baseVersion = initialProjectData.versions[0]!;

describe("floorValidationSummary", () => {
  it("builds one summary row per physical level", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const validation = validatePlanVersion(expanded, { codeContext: defaultHealthcareCodeContext, projectType: "healthcare" });
    const summary = buildFloorValidationSummary(expanded, validation.issues);

    expect(summary).toHaveLength(4);
    expect(summary.map((item) => item.levelId)).toEqual(["level-01", "level-02", "level-03", "level-04"]);
    expect(summary.every((item) => typeof item.issueCount === "number")).toBe(true);
    expect(summary.every((item) => Array.isArray(item.messages))).toBe(true);
  });

  it("is written into metadata by postProcessPlanVersion", () => {
    const processed = postProcessPlanVersion(baseVersion, {
      codeContext: defaultHealthcareCodeContext,
      projectType: "healthcare"
    });

    expect(processed.metadata?.floorValidationSummary?.length).toBeGreaterThan(0);
    expect(processed.metadata?.floorValidationSummary?.[0]).toMatchObject({
      levelId: expect.any(String),
      levelName: expect.any(String),
      issueCount: expect.any(Number),
      errorCount: expect.any(Number),
      warningCount: expect.any(Number),
      valid: expect.any(Boolean)
    });
  });

  it("tracks per-floor programs on multi-floor post-process", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const processed = postProcessPlanVersion(expanded, {
      codeContext: defaultHealthcareCodeContext,
      projectType: "healthcare"
    });

    expect(processed.metadata?.floorValidationSummary).toHaveLength(4);
    expect(processed.metadata?.floorValidationSummary?.[0]?.floorProgram).toBe("ground");
    expect(processed.metadata?.floorValidationSummary?.[1]?.floorProgram).toBe("typical");
    expect(processed.metadata?.floorValidationSummary?.[3]?.floorProgram).toBe("top");
  });
});
