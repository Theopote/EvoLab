import { describe, expect, it } from "vitest";
import { buildPathGraph } from "@/lib/analysis/path-graph";
import {
  computeSemanticEgressForRoom,
  findSemanticEgressRoute
} from "@/lib/analysis/egress-semantics";
import { createDemoProjectData } from "@/lib/typologies/demo-project";
import { initialProjectData } from "@/lib/evolab-data";
import type { PlanVersion, Point } from "@/lib/project-types";
import { computeEgressPathMetrics } from "@/lib/rules/path-metrics";

const baseVersion = initialProjectData.versions[0]!;
const healthcareVersion = createDemoProjectData("healthcare").versions[0]!;

describe("semantic egress chain", () => {
  it("routes private rooms through door, corridor, and stair", () => {
    const graph = buildPathGraph(healthcareVersion);
    const route = findSemanticEgressRoute(graph, healthcareVersion, "consult-01", "core-01");

    expect(route).toBeDefined();
    expect(route?.semanticValid).toBe(true);
    expect(route?.chain.some((step) => step.kind === "portal")).toBe(true);
    expect(route?.chain.some((step) => step.roomType === "corridor")).toBe(true);
    expect(route?.chain.some((step) => step.roomType === "elevator" || step.roomType === "stair")).toBe(true);
  });

  it("prefers semantic routes over incomplete shortcuts", () => {
    const route = computeSemanticEgressForRoom(baseVersion, "office-01");

    expect(route).toBeDefined();
    expect(route?.semanticValid).toBe(true);
    expect(route?.method.startsWith("semantic-")).toBe(true);
    expect(route?.missingLinks).toEqual([]);
  });

  it("reports incomplete chains when door and corridor are missing", () => {
    const boxedVersion: PlanVersion = {
      ...baseVersion,
      levels: baseVersion.levels.map((level) => ({ ...level, openings: [] })),
      rooms: [
        {
          id: "room-a",
          name: "Isolated Office",
          type: "office" as const,
          zone: "private" as const,
          polygon: [
            [0, 0],
            [10, 0],
            [10, 8],
            [0, 8]
          ] satisfies Point[],
          areaSqm: 80,
          ceilingHeight: 3,
          doors: [],
          windows: [],
          adjacents: ["stair-1"]
        },
        {
          id: "stair-1",
          name: "Exit Stair",
          type: "stair" as const,
          zone: "circulation" as const,
          polygon: [
            [10, 0],
            [14, 0],
            [14, 8],
            [10, 8]
          ] satisfies Point[],
          areaSqm: 32,
          ceilingHeight: 3,
          doors: [],
          windows: [],
          adjacents: ["room-a"]
        }
      ]
    };

    const route = computeSemanticEgressForRoom(boxedVersion, "room-a");

    expect(route).toBeDefined();
    expect(route?.semanticValid).toBe(false);
    expect(route?.method).toBe("semantic-incomplete");
    expect(route?.missingLinks).toContain("door");
    expect(route?.missingLinks).not.toContain("stair");
  });

  it("aggregates semantic egress metrics for compliance", () => {
    const metrics = computeEgressPathMetrics(baseVersion);

    expect(metrics.maxDistance).toBeGreaterThan(0);
    expect(metrics.semanticRouteCount).toBeGreaterThan(0);
    expect(["semantic-opening-aware", "semantic-door-aware", "semantic-adjacency", "semantic-incomplete", "centroid-fallback"]).toContain(
      metrics.method
    );
    expect(metrics.perRoom.every((room) => Array.isArray(room.missingLinks))).toBe(true);
  });
});
