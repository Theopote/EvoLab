import { describe, expect, it, vi } from "vitest";
import { createDemoProjectData } from "@/lib/typologies";
import {
  stripVersionForDraftValidation,
  validateAndNormalizeProjectVersions,
  validatePlanVersionInput
} from "@/lib/schemas/store-boundary";
import type { PlanVersion } from "@/lib/project-types";

describe("store-boundary validation", () => {
  it("accepts demo project versions", () => {
    const version = createDemoProjectData("office").versions[0]!;

    expect(validatePlanVersionInput(version, "test")).toBe(true);
    expect(stripVersionForDraftValidation(version).rooms.length).toBeGreaterThan(0);
  });

  it("rejects versions with invalid room polygons", () => {
    const version = createDemoProjectData("office").versions[0]!;
    const invalid = {
      ...version,
      rooms: [{ ...version.rooms[0]!, polygon: [[0, 0]] }]
    } as PlanVersion;

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(validatePlanVersionInput(invalid, "test")).toBe(false);
    warn.mockRestore();
  });

  it("normalizes validated project versions", () => {
    const versions = createDemoProjectData("healthcare").versions;
    const normalized = validateAndNormalizeProjectVersions(versions, "test");

    expect(normalized).toHaveLength(versions.length);
    expect(normalized[0]?.levels.length).toBeGreaterThan(0);
  });
});
