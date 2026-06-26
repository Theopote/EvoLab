import { describe, expect, it } from "vitest";
import { createMockIntakeSynthesis } from "@/lib/intake/mock-intake-synthesis";

describe("mock-intake-synthesis", () => {
  it("returns structured intake fields from uploaded materials", () => {
    const result = createMockIntakeSynthesis([
      { fileName: "brief.txt", kind: "text", content: "Hospital retrofit with retained structure." }
    ]);

    expect(result.summary).toContain("brief.txt");
    expect(result.constraints.length).toBeGreaterThan(0);
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.fallback).toBe(true);
  });
});
