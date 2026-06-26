import { describe, expect, it } from "vitest";
import { normalizePlanVersion } from "@/lib/architecture-model";
import {
  createDxfExportDocument,
  DXF_EXPORT_LAYERS,
  resolveOpeningExportLayer,
  resolveWallExportLayer
} from "@/lib/export-dxf";
import { edgeKey } from "@/lib/wall-extractor";
import type { OpeningElement, PlanVersion, Point, Room, Wall } from "@/lib/project-types";

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

const externalWalls: Wall[] = [
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

const internalWall: Wall = {
  id: "wall-internal",
  start: [6, 1],
  end: [6, 9],
  thickness: 0.15,
  height: 3,
  type: "internal",
  roomIds: ["room-a"]
};

const coreWall: Wall = {
  id: "wall-core",
  start: [10, 2],
  end: [10, 8],
  thickness: 0.25,
  height: 3,
  type: "core",
  roomIds: ["room-a"]
};

const door: OpeningElement = {
  id: "cad-door-1",
  wallId: "cad-wall-south",
  wallEdgeId: edgeKey(externalWalls[2]!.start, externalWalls[2]!.end),
  positionOnEdge: 0.5,
  type: "door",
  center: [6, 10],
  width: 1,
  height: 2.1,
  roomIds: ["room-a"]
};

const window: OpeningElement = {
  id: "window-1",
  wallId: "cad-wall-north",
  wallEdgeId: edgeKey(externalWalls[0]!.start, externalWalls[0]!.end),
  positionOnEdge: 0.2,
  type: "window",
  center: [2, 0],
  width: 1.5,
  height: 1.2,
  roomIds: ["room-a"]
};

function createAuthoritativeVersion(): PlanVersion {
  return normalizePlanVersion({
    id: "dxf-scheme",
    label: "DXF scheme",
    createdAt: "2026-06-26T00:00:00.000Z",
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
        walls: externalWalls,
        openings: [door]
      }
    ]
  });
}

describe("export dxf", () => {
  it("maps walls and openings to semantic layers", () => {
    expect(resolveWallExportLayer(externalWalls[0]!)).toBe(DXF_EXPORT_LAYERS.WALL_EXTERNAL);
    expect(resolveWallExportLayer(internalWall)).toBe(DXF_EXPORT_LAYERS.WALL_INTERNAL);
    expect(resolveWallExportLayer(coreWall)).toBe(DXF_EXPORT_LAYERS.CORE);
    expect(resolveOpeningExportLayer(door)).toBe(DXF_EXPORT_LAYERS.OPENING_DOOR);
    expect(resolveOpeningExportLayer(window)).toBe(DXF_EXPORT_LAYERS.OPENING_WINDOW);
  });

  it("exports category layers instead of per-element layer names", () => {
    const dxf = createDxfExportDocument(createAuthoritativeVersion());

    expect(dxf).toContain(DXF_EXPORT_LAYERS.WALL_EXTERNAL);
    expect(dxf).toContain(DXF_EXPORT_LAYERS.OPENING_DOOR);
    expect(dxf).toContain(DXF_EXPORT_LAYERS.ROOM_BOUNDARY);
    expect(dxf).toContain(DXF_EXPORT_LAYERS.ROOM_TEXT);
    expect(dxf).toContain(DXF_EXPORT_LAYERS.FLOOR);
    expect(dxf).toContain(DXF_EXPORT_LAYERS.GRID);
    expect(dxf).not.toContain("EVOLAB-WALL-cad-wall-north");
    expect(dxf).not.toContain("EVOLAB-OPENING-cad-door-1");
  });

  it("writes metric units and room annotations", () => {
    const dxf = createDxfExportDocument(createAuthoritativeVersion());

    expect(dxf).toContain("$INSUNITS");
    expect(dxf).toContain("Office");
    expect(dxf).toContain("80.0 m2");
    expect(dxf).toContain("LWPOLYLINE");
    expect((dxf.match(/^TEXT$/gm) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("exports door openings as wall-width line segments instead of marker circles", () => {
    const dxf = createDxfExportDocument(createAuthoritativeVersion());

    expect(dxf).toContain(DXF_EXPORT_LAYERS.OPENING_DOOR);
    expect(dxf).not.toMatch(/CIRCLE\n8\nEVOLAB-OPENING/);
    expect((dxf.match(/^LINE$/gm) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
