import { describe, expect, it } from "vitest";
import { buildDxfExportFileName } from "@/lib/export-utils";

describe("buildDxfExportFileName", () => {
  it("uses source stem and ISO date", () => {
    expect(buildDxfExportFileName("scan floor plan.pdf", new Date("2026-06-27T12:00:00.000Z"))).toBe(
      "scan-floor-plan-2026-06-27.dxf"
    );
  });

  it("falls back when source name is missing", () => {
    expect(buildDxfExportFileName(undefined, new Date("2026-06-27T12:00:00.000Z"))).toBe("evolab-export-2026-06-27.dxf");
  });
});
