import { describe, expect, it } from "vitest";
import { measurePolygonClearWidth } from "@/lib/rules/metrics/corridor-width";
import type { Point } from "@/lib/project-types";
import { createMockPlanVersions } from "@/lib/mock-api";
import { resolveTypologyPack, resolveTypologyPackId } from "@/lib/typology/resolve";
import { canonicalizeAnalysisLayerId } from "@/lib/typology/analysis-layers";
import {
  buildPlanTopologyVersionsFromPack,
  buildTopologyEdgesFromPack,
  buildTopologyRoomsFromStrategy,
  getTopologyPromptContext
} from "@/lib/typology/topology";
import { officeTypologyPack, schoolTypologyPack } from "@/lib/typology/packs";
import { topologiesToPlanVersions } from "@/lib/topology-geometry";

describe("typology packs", () => {
  it("resolves healthcare aliases", () => {
    expect(resolveTypologyPackId("clinic")).toBe("healthcare");
    expect(resolveTypologyPack("hospital").id).toBe("healthcare");
  });

  it("resolves school from education alias", () => {
    expect(resolveTypologyPackId("education")).toBe("school");
    expect(resolveTypologyPack("education").flowDefinitions[0].layerId).toBe("primary_flow");
  });

  it("canonicalizes legacy analysis layer ids", () => {
    expect(canonicalizeAnalysisLayerId("patient_flow")).toBe("primary_flow");
    expect(canonicalizeAnalysisLayerId("clean_dirty_flow")).toBe("service_flow");
  });
});

describe("typology topology generation", () => {
  it("builds office topology rooms and edges from pack", () => {
    const strategy = officeTypologyPack.topology.strategies[0];
    const rooms = buildTopologyRoomsFromStrategy(officeTypologyPack, strategy, 1200);
    const edges = buildTopologyEdgesFromPack(officeTypologyPack, rooms);

    expect(rooms.some((room) => room.type === "office")).toBe(true);
    expect(rooms.some((room) => room.type === "lobby")).toBe(true);
    expect(edges.some((edge) => edge.from === "lobby-01" || edge.to === "lobby-01")).toBe(true);
  });

  it("builds school topology versions with classroom rooms", () => {
    const versions = buildPlanTopologyVersionsFromPack(schoolTypologyPack, 1500);

    expect(versions).toHaveLength(3);
    expect(versions[0].rooms.some((room) => room.type === "other")).toBe(true);
    expect(versions[0].topology.circulation.toLowerCase()).toContain("corridor");
  });

  it("converts typology topologies into valid plan geometry", () => {
    const versions = buildPlanTopologyVersionsFromPack(officeTypologyPack, 1200);
    const plans = topologiesToPlanVersions(versions, { wetRoomTypes: officeTypologyPack.topology.wetRoomTypes });

    expect(plans).toHaveLength(3);
    expect(plans[0].rooms.length).toBeGreaterThan(4);
    expect(plans[0].rooms.some((room) => room.type === "corridor")).toBe(true);
  });

  it("includes typology guidance for AI prompts", () => {
    const guidance = getTopologyPromptContext(schoolTypologyPack);
    expect(guidance).toContain("School");
    expect(guidance).toContain("Classrooms");
  });

  it("creates office and school mock layouts by project type", () => {
    const officeVersions = createMockPlanVersions(undefined, "office");
    const schoolVersions = createMockPlanVersions(undefined, "education");

    expect(officeVersions[0].rooms.some((room) => room.type === "office")).toBe(true);
    expect(schoolVersions[0].rooms.some((room) => room.type === "other")).toBe(true);
    expect(officeVersions[0].metadata?.strategy).not.toBe(schoolVersions[0].metadata?.strategy);
  });
});

describe("corridor clear width", () => {
  it("measures rectangular corridor width accurately", () => {
    const corridor: Point[] = [
      [0, 0],
      [20, 0],
      [20, 2.4],
      [0, 2.4]
    ];

    expect(measurePolygonClearWidth(corridor)).toBeCloseTo(2.4, 1);
  });

  it("detects narrow section in L-shaped corridor better than bbox", () => {
    const corridor: Point[] = [
      [0, 0],
      [20, 0],
      [20, 2],
      [2, 2],
      [2, 8],
      [0, 8]
    ];

    const clearWidth = measurePolygonClearWidth(corridor);
    expect(clearWidth).toBeLessThanOrEqual(2.05);
    expect(clearWidth).toBeGreaterThan(1.5);
  });
});
