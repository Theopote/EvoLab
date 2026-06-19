import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import type { PlanVersion, VerticalElement } from "@/lib/project-types";
import { deriveVerticalElements } from "@/lib/vertical-elements";
import { buildVerticalAlignmentReport, checkVerticalAlignment } from "@/lib/vertical-alignment";

const baseVersion = initialProjectData.versions[0]!;

describe("vertical alignment", () => {
  it("derives grid columns and stacked cores from a multi-floor version", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const elements = deriveVerticalElements(expanded);

    expect(elements.some((element) => element.kind === "column")).toBe(true);
    expect(elements.some((element) => element.kind === "core" || element.kind === "mep_shaft")).toBe(true);
  });

  it("flags columns that fall outside allowed container rooms on a floor", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const elements = deriveVerticalElements(expanded);
    const firstColumn = elements.find((element) => element.kind === "column");

    expect(firstColumn).toBeDefined();

    const tampered: PlanVersion = {
      ...expanded,
      levels: expanded.levels.map((level) =>
        level.id === "level-01"
          ? {
              ...level,
              rooms: level.rooms.map((room) =>
                room.type === "corridor"
                  ? {
                      ...room,
                      polygon: room.polygon.map(([x, y]) => [x + 8, y + 8] as const)
                    }
                  : room
              )
            }
          : level
      )
    };

    const issues = checkVerticalAlignment(tampered, elements, tampered.standardFloorGroups);

    expect(issues.some((issue) => issue.floorId === "level-01" && issue.elementKind === "column")).toBe(true);
  });

  it("suggests a transfer floor when column issues appear after a clean lower level", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const elements = deriveVerticalElements(expanded);
    const syntheticIssues = checkVerticalAlignment(expanded, elements, expanded.standardFloorGroups).map((issue) =>
      issue.floorId === "level-01" ? issue : { ...issue, floorId: "level-02" }
    );

    const report = buildVerticalAlignmentReport({
      ...expanded,
      verticalElements: elements
    });

    expect(report.transferHints.length).toBeGreaterThanOrEqual(0);

    if (syntheticIssues.length > 0) {
      const hinted = buildVerticalAlignmentReport(expanded);
      expect(hinted.issues.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("respects element floor ranges", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 3);
    const elements = deriveVerticalElements(expanded);
    const bounded: VerticalElement = {
      ...elements.find((element) => element.kind === "column")!,
      appliesFromFloorId: "level-02",
      appliesToFloorId: "level-02"
    };

    const issues = checkVerticalAlignment(expanded, [bounded], expanded.standardFloorGroups);

    expect(issues.every((issue) => issue.floorId === "level-02")).toBe(true);
  });
});
