import { normalizePlanVersion } from "@/lib/architecture-model";
import { createDxfExportDocument } from "@/lib/export-dxf";
import { createIfcExportPayload } from "@/lib/ifc-export-contract";
import { createSetbackBoundary } from "@/lib/geometry/operations/offset";
import { mergeAdjacentRooms, splitRectRoom } from "@/lib/geometry/operations/room-topology";
import { constrainOrthoDelta, snapPoint } from "@/lib/geometry/snapping";
import {
  applyWallDragByOffset,
  deriveWallGraph,
  edgeUnitNormal,
  widthAlongNormal
} from "@/lib/geometry/topology/wall-graph";
import { resolveExportLevelGeometry } from "@/lib/geometry/walls/export-authoritative-walls";
import { detectGapsAndOverlaps } from "@/lib/geometry/validation/gap-overlap";
import { edgeKey } from "@/lib/geometry/topology/edges";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";

export interface GeometrySimulationStep {
  id: string;
  ok: boolean;
  message: string;
  metrics?: Record<string, number | string | boolean>;
}

export interface GeometrySimulationReport {
  scenario: string;
  passed: boolean;
  steps: GeometrySimulationStep[];
}

const outline: Point[] = [
  [0, 0],
  [12, 0],
  [12, 10],
  [0, 10]
];

function step(
  id: string,
  ok: boolean,
  message: string,
  metrics?: GeometrySimulationStep["metrics"]
): GeometrySimulationStep {
  return { id, ok, message, metrics };
}

function baseRoom(overrides?: Partial<Room>): Room {
  return {
    id: "room-a",
    name: "Office",
    type: "office",
    zone: "private",
    polygon: [
      [0, 0],
      [8, 0],
      [8, 6],
      [0, 6]
    ],
    areaSqm: 48,
    ceilingHeight: 3,
    doors: [],
    windows: [],
    ...overrides
  };
}

function defaultNeighborRoom(): Room {
  return {
    id: "room-b",
    name: "Meeting",
    type: "consultation",
    zone: "semi_public",
    polygon: [
      [8, 0],
      [12, 0],
      [12, 6],
      [8, 6]
    ],
    areaSqm: 24,
    ceilingHeight: 3,
    doors: [],
    windows: []
  };
}

const authoritativeWalls: Wall[] = [
  {
    id: "cad-wall-north",
    start: [0, 0],
    end: [12, 0],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a", "room-b"]
  },
  {
    id: "cad-wall-east",
    start: [12, 0],
    end: [12, 10],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-b"]
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
  wallId: "cad-wall-south",
  wallEdgeId: edgeKey([12, 10], [0, 10]),
  positionOnEdge: 0.5,
  type: "door",
  center: [6, 10],
  width: 1,
  height: 2.1,
  roomIds: ["room-a"]
};

export function simulateSnappingAndOrtho(): GeometrySimulationReport {
  const snapped = snapPoint([1.04, 2.06], { gridStep: 0.1 });
  const ortho = constrainOrthoDelta([0, 0], [4, 0.15], 8);
  const steps = [
    step("grid-snap", snapped[0] === 1 && snapped[1] === 2.1, "Pointer snaps to grid", {
      x: snapped[0],
      y: snapped[1]
    }),
    step("ortho-delta", ortho[1] === 0 && ortho[0] === 4, "Drag delta locks to horizontal axis", {
      dx: ortho[0],
      dy: ortho[1]
    })
  ];

  return {
    scenario: "snapping-and-ortho",
    passed: steps.every((item) => item.ok),
    steps
  };
}

export function simulateRoomSplitMerge(): GeometrySimulationReport {
  const room = baseRoom();
  const split = splitRectRoom(room, "vertical", 0.5, { id: "room-a2", name: "Office B" });
  const mergedBack = split ? mergeAdjacentRooms(split.first, split.second, { id: "room-merged", name: "Office merged" }) : undefined;

  const steps = [
    step("split", Boolean(split), "Rect room splits into two polygons", {
      firstArea: split?.first.areaSqm ?? 0,
      secondArea: split?.second.areaSqm ?? 0
    }),
    step("merge", Boolean(mergedBack), "Adjacent halves merge back through boolean union", {
      mergedArea: mergedBack?.areaSqm ?? 0
    })
  ];

  return {
    scenario: "room-split-merge",
    passed: steps.every((item) => item.ok),
    steps
  };
}

export function simulateWallDragClamp(): GeometrySimulationReport {
  const rooms = [baseRoom(), defaultNeighborRoom()];
  const graph = deriveWallGraph(rooms);
  const sharedEdge = graph.edges.find((edge) => edge.roomIds.length > 1);

  if (!sharedEdge) {
    return {
      scenario: "wall-drag-clamp",
      passed: false,
      steps: [step("shared-edge", false, "Shared interior wall not found")]
    };
  }

  const normal = edgeUnitNormal(sharedEdge.nodeA, sharedEdge.nodeB);
  const dragged = applyWallDragByOffset(rooms, sharedEdge.id, 0.8, normal);
  const draggedRoomA = dragged.find((room) => room.id === "room-a")!;
  const width = widthAlongNormal(draggedRoomA.polygon, normal);

  const steps = [
    step("drag-commit", dragged !== rooms, "Interior wall drag mutates room polygons"),
    step("clamp", width >= 0.5, "Drag respects minimum room width clamp", {
      wallId: sharedEdge.id,
      clearWidth: width
    })
  ];

  return {
    scenario: "wall-drag-clamp",
    passed: steps.every((item) => item.ok),
    steps
  };
}

export function simulateGapOverlapValidation(): GeometrySimulationReport {
  const tilingOutline: Point[] = [
    [0, 0],
    [12, 0],
    [12, 6],
    [0, 6]
  ];
  const rooms = [baseRoom(), defaultNeighborRoom()];
  const clean = detectGapsAndOverlaps(tilingOutline, rooms);
  const overlapping = detectGapsAndOverlaps(tilingOutline, [
    baseRoom(),
    {
      ...defaultNeighborRoom(),
      polygon: [
        [7, 0],
        [12, 0],
        [12, 6],
        [7, 6]
      ]
    }
  ]);

  const steps = [
    step("clean-layout", clean.length === 0, "Tiled rooms pass gap/overlap validation"),
    step("overlap-detect", overlapping.some((issue) => issue.kind === "overlap"), "Overlapping rooms are flagged", {
      issueCount: overlapping.length
    })
  ];

  return {
    scenario: "gap-overlap-validation",
    passed: steps.every((item) => item.ok),
    steps
  };
}

export function simulateSetbackInset(): GeometrySimulationReport {
  const setback = createSetbackBoundary(outline, 1);
  const steps = [
    step("setback-valid", setback.valid, "Outline inset produces buildable envelope", {
      areaSqm: setback.areaSqm,
      vertexCount: setback.buildable.length
    }),
    step("setback-smaller", setback.areaSqm < 120, "Inset area is smaller than source outline")
  ];

  return {
    scenario: "setback-inset",
    passed: steps.every((item) => item.ok),
    steps
  };
}

export function simulateAuthoritativeExport(): GeometrySimulationReport {
  const version = normalizePlanVersion({
    id: "sim-wall-first",
    label: "Simulation",
    createdAt: "2026-06-25T00:00:00.000Z",
    outline,
    overallBounds: { width: 12, height: 10 },
    rooms: [baseRoom({ polygon: [[1, 1], [11, 1], [11, 9], [1, 9]], levelId: "level-01" })],
    levels: [
      {
        id: "level-01",
        name: "Level 01",
        floorNumber: 1,
        elevation: 0,
        height: 3,
        rooms: [baseRoom({ polygon: [[1, 1], [11, 1], [11, 9], [1, 9]], levelId: "level-01" })],
        walls: authoritativeWalls,
        openings: [authoritativeOpening]
      }
    ]
  });

  const level = version.levels[0] as Level;
  const geometry = resolveExportLevelGeometry(level);
  const ifc = createIfcExportPayload(version);
  const dxf = createDxfExportDocument(version);
  const graph = deriveWallGraph([baseRoom(), defaultNeighborRoom()]);
  const shared = graph.edges.find((edge) => edge.roomIds.length > 1);

  const steps = [
    step("authoritative-gate", geometry.authoritative, "Level.walls passes authoritative gate"),
    step("ifc-walls", ifc.storeys[0]!.walls.some((wall) => wall.id.startsWith("cad-wall-")), "IFC exports stored wall ids"),
    step("dxf-walls", dxf.includes("EVOLAB-WALL-cad-wall-north"), "DXF emits authoritative wall layers"),
    step("topology-shared-edge", Boolean(shared), "Topology graph finds shared interior edge", {
      edgeId: shared?.id ?? "none"
    })
  ];

  return {
    scenario: "authoritative-export",
    passed: steps.every((item) => item.ok),
    steps
  };
}

export function runGeometryCoreSimulations(): GeometrySimulationReport[] {
  return [
    simulateSnappingAndOrtho(),
    simulateRoomSplitMerge(),
    simulateWallDragClamp(),
    simulateGapOverlapValidation(),
    simulateSetbackInset(),
    simulateAuthoritativeExport()
  ];
}

export function summarizeGeometrySimulations(reports = runGeometryCoreSimulations()) {
  return {
    total: reports.length,
    passed: reports.filter((report) => report.passed).length,
    failed: reports.filter((report) => !report.passed).map((report) => report.scenario),
    reports
  };
}
