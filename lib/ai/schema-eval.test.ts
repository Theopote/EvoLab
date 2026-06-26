import { describe, expect, it } from "vitest";
import generatePlanRequestFixture from "@/lib/ai/eval/generate-plan-request.fixture.json";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { generateRuleBasedMep } from "@/lib/mep-router";
import { GenerateMepToolInputSchema, MepLayoutSchema } from "@/lib/schemas/mep-schema";
import { GeneratePlanRequestSchema } from "@/lib/schemas/generate-plan-request-schema";

describe("AI schema eval (layer 1)", () => {
  it("validates the recorded generate-plan request fixture", () => {
    const parsed = GeneratePlanRequestSchema.safeParse(generatePlanRequestFixture);

    expect(parsed.success).toBe(true);
  });

  it("validates deterministic MEP output against GenerateMepToolInputSchema", () => {
    const version = expandPlanVersionToFloors(initialProjectData.versions[0]!, 4);
    const output = generateRuleBasedMep(version);
    const parsed = GenerateMepToolInputSchema.safeParse(output);

    expect(parsed.success).toBe(true);
  });

  it("validates single-floor MEP layout shape invariants", () => {
    const version = initialProjectData.versions[0]!;
    const parsed = MepLayoutSchema.safeParse(generateRuleBasedMep(version).mep);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.routes.every((route) => route.path.length >= 2)).toBe(true);
    expect(parsed.data?.shafts.every((shaft) => shaft.systems.length > 0)).toBe(true);
  });
});
