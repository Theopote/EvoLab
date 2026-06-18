import { describe, expect, it } from "vitest";
import { buildPathGraph } from "@/lib/analysis/path-graph";
import {
  computeSemanticEgressForRoom,
  findSemanticEgressRoute,
  findNearestSemanticExitPath
} from "@/lib/analysis/egress-semantics";
import { initialProjectData } from "@/lib/evolab-data";
import { computeEgressPathMetrics } from "@/lib/rules/path-metrics";

const baseVersion = initialProjectData.versions[0]!;

describe("semantic egress chain", () => {
  it("routes private rooms through door, corridor, and stair", () => {
    const graph = buildPathGraph(baseVersion);
    const route = findSemanticEgressRoute(graph, baseVersion, "consult-01", "core-01");

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

  it("reports incomplete chains when corridor is bypassed", () => {
    const isolatedVersion = {
      ...baseVersion,
      rooms: baseVersion.rooms.map((room) =>
        room.id === "consult-01"
          ? {
              ...room,
              adjacents: ["core-01"],
              doors: []
            }
          : room
      )
    };

    const graph = buildPathGraph(isolatedVersion);
    const route = findNearestSemanticExitPath(graph, isolatedVersion, "consult-01");

    expect(route).toBeDefined();
    expect(route?.semanticValid).toBe(false);
    expect(route?.method).toBe("semantic-incomplete");
    expect(route?.missingLinks).toContain("door");
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
