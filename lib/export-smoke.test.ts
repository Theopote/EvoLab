import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { initialProjectData } from "@/lib/evolab-data";
import { createDxfExportDocument } from "@/lib/export-dxf";
import { createIfcExportPayload } from "@/lib/ifc-export-contract";
import { buildGltfGroup } from "@/lib/export-gltf";
import { buildPlanPrintHtml } from "@/lib/export-plan-pdf";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { edgeKey } from "@/lib/wall-extractor";
import type { OpeningElement, PlanVersion, Point, Room, Wall } from "@/lib/project-types";

const baseVersion = initialProjectData.versions[0]!;

const outline: Point[] = [
  [0, 0],
  [12, 0],
  [12, 10],
  [0, 10]
];

const insetRoom: Room = {
  id: "room-a",
  name: "Office",
  type: "office",
  zone: "private",
  polygon: [
    [1, 1],
    [11, 1],
    [11, 9],
    [1, 9]
  ],
  areaSqm: 80,
  ceilingHeight: 3,
  doors: [],
  windows: []
};

const authoritativeWalls: Wall[] = [
  {
    id: "cad-wall-north",
    start: [0, 0],
    end: [12, 0],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  },
  {
    id: "cad-wall-east",
    start: [12, 0],
    end: [12, 10],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  },
  {
    id: "cad-wall-south",
    start: [12, 10],
    end: [0, 10],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  },
  {
    id: "cad-wall-west",
    start: [0, 10],
    end: [0, 0],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  }
];

const authoritativeOpening: OpeningElement = {
  id: "cad-door-1",
  wallId: authoritativeWalls[2]!.id,
  wallEdgeId: edgeKey(authoritativeWalls[2]!.start, authoritativeWalls[2]!.end),
  positionOnEdge: 0.5,
  type: "door",
  center: [6, 10],
  width: 1,
  height: 2.1,
  roomIds: ["room-a"]
};

function createAuthoritativeWallFirstVersion(): PlanVersion {
  return normalizePlanVersion({
    id: "wall-first-scheme",
    label: "Wall-first scheme",
    createdAt: "2026-06-25T00:00:00.000Z",
    outline,
    overallBounds: { width: 12, height: 10 },
    rooms: [{ ...insetRoom, levelId: "level-01" }],
    levels: [
      {
        id: "level-01",
        name: "Level 01",
        floorNumber: 1,
        elevation: 0,
        height: 3,
        rooms: [{ ...insetRoom, levelId: "level-01" }],
        walls: authoritativeWalls,
        openings: [authoritativeOpening]
      }
    ]
  });
}

function createNonAuthoritativeVersion(): PlanVersion {
  const version = createAuthoritativeWallFirstVersion();
  const level = version.levels[0]!;

  return {
    ...version,
    levels: [
      {
        ...level,
        walls: level.walls.slice(0, 2),
        openings: level.openings
      }
    ]
  };
}

describe("export smoke tests", () => {
  it("builds a gltf scene graph for the active scheme", () => {
    const group = buildGltfGroup(baseVersion);

    expect(group.name).toBe(baseVersion.label);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it("builds exportable mesh geometry in the gltf group", () => {
    const group = buildGltfGroup(baseVersion);
    let meshCount = 0;

    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount += 1;
      }
    });

    expect(meshCount).toBeGreaterThan(0);
  });

  it("builds printable plan html with svg markup", () => {
    const totalArea = baseVersion.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
    const html = buildPlanPrintHtml(baseVersion, totalArea);

    expect(html).toContain("<svg");
    expect(html).toContain(baseVersion.label);
    expect(html).toContain(`${baseVersion.rooms.length} rooms`);
  });

  it("creates ifc export payload with storeys and spaces", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const payload = createIfcExportPayload(expanded);

    expect(payload.storeys.length).toBe(4);
    expect(payload.storeys.every((storey) => storey.spaces.length > 0)).toBe(true);
    expect(payload.project.name.length).toBeGreaterThan(0);
  });

  it("exports authoritative Level.walls ids in the ifc payload", () => {
    const version = createAuthoritativeWallFirstVersion();
    const payload = createIfcExportPayload(version);
    const storey = payload.storeys[0]!;

    expect(storey.walls.map((wall) => wall.id)).toEqual([
      "cad-wall-north",
      "cad-wall-east",
      "cad-wall-south",
      "cad-wall-west"
    ]);
    expect(storey.openings).toHaveLength(1);
    expect(storey.openings[0]?.wallId).toBe("cad-wall-south");
    expect(payload.notes.some((note) => note.includes("authoritative Level.walls"))).toBe(true);
  });

  it("omits walls from ifc export when Level.walls is not authoritative", () => {
    const version = createNonAuthoritativeVersion();
    const payload = createIfcExportPayload(version);
    const storey = payload.storeys[0]!;

    expect(storey.walls).toEqual([]);
    expect(storey.openings).toEqual([]);
    expect(payload.notes.some((note) => note.includes("walls and openings omitted"))).toBe(true);
  });

  it("reads stored Level.walls geometry instead of recomputing from rooms during ifc export", () => {
    const version = createAuthoritativeWallFirstVersion();
    const level = version.levels[0]!;
    const shiftedNorth: Wall = {
      ...level.walls[0]!,
      start: [0.5, 0.5],
      end: [12.5, 0.5]
    };

    const shiftedVersion: PlanVersion = {
      ...version,
      levels: [{ ...level, walls: [shiftedNorth, ...level.walls.slice(1)] }]
    };

    const exportedStart = createIfcExportPayload(shiftedVersion).storeys[0]!.walls[0]!.start;

    expect(exportedStart).toEqual([0.5, 0.5]);
  });

  it("writes authoritative walls to dxf layers named after wall ids", () => {
    const version = createAuthoritativeWallFirstVersion();
    const dxf = createDxfExportDocument(version);

    expect(dxf).toContain("EVOLAB-WALL-cad-wall-north");
    expect(dxf).toContain("EVOLAB-WALL-cad-wall-south");
    expect(dxf).toContain("EVOLAB-OPENING-cad-door-1");
    expect((dxf.match(/^LINE$/gm) ?? []).length).toBe(4);
  });

  it("writes no wall entities to dxf when Level.walls is not authoritative", () => {
    const dxf = createDxfExportDocument(createNonAuthoritativeVersion());

    expect(dxf).not.toContain("EVOLAB-WALL-");
    expect(dxf).not.toContain("EVOLAB-OPENING-");
  });
});
