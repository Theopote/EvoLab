import { describe, expect, it } from "vitest";
import { buildGeometryPhaseInput, finalizePlanGeometryVersion } from "@/lib/generate-plan-geometry";
import { resolveGeneratePlanConstraints } from "@/lib/generate-plan-constraints";
import { buildPlanTopologyVersionsFromPack } from "@/lib/typology/topology";
import { officeTypologyPack } from "@/lib/typology/packs";

describe("generate plan geometry phase", () => {
  it("builds LLM geometry input from topology and constraints", () => {
    const topology = buildPlanTopologyVersionsFromPack(officeTypologyPack, 1200)[0];
    const body = {
      outline: [
        [0, 0],
        [72, 0],
        [72, 42],
        [0, 42]
      ] as [number, number][],
      projectType: "office"
    };
    const constraints = resolveGeneratePlanConstraints(body);
    const input = buildGeometryPhaseInput(topology, constraints, body);

    expect(input.topology.id).toBe(topology.id);
    expect(input.topology.rooms.length).toBeGreaterThan(4);
    expect(input.overallBounds.width).toBeGreaterThan(0);
    expect(input.overallBounds.height).toBeGreaterThan(0);
    expect(input.outline.length).toBeGreaterThanOrEqual(3);
    expect(input.layoutOutline.length).toBeGreaterThanOrEqual(3);
  });

  it("stamps topology graph metadata when finalizing LLM geometry", () => {
    const topology = buildPlanTopologyVersionsFromPack(officeTypologyPack, 1200)[0];
    const outline = [
      [0, 0],
      [72, 0],
      [72, 42],
      [0, 42]
    ] as [number, number][];

    const version = finalizePlanGeometryVersion(
      {
        id: topology.id,
        label: topology.label,
        createdAt: new Date().toISOString(),
        outline,
        overallBounds: { width: 72, height: 42 },
        rooms: topology.rooms.map((room) => ({
          id: room.id,
          name: room.name,
          type: room.type,
          zone: room.zone,
          polygon: [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10]
          ],
          areaSqm: room.targetAreaSqm,
          ceilingHeight: room.ceilingHeight ?? 3.3,
          doors: [],
          windows: [],
          adjacents: room.adjacencyIds,
          needsDaylight: room.needsDaylight,
          needsPlumbing: room.needsPlumbing
        }))
      },
      topology,
      outline
    );

    expect(version.metadata?.topologyGraph?.rooms.length).toBe(topology.rooms.length);
    expect(version.metadata?.topology?.circulation).toBe(topology.topology.circulation);
    expect(version.metadata?.strategy).toBe(topology.strategy);
  });
});
