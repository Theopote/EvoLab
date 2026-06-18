import { describe, expect, it } from "vitest";
import { parseDxfToGraph } from "@/lib/plan-import/dxf-import";
import { buildPlanVersionFromGraph } from "@/lib/plan-import/graph-to-version";
import type { RecognizedPlanGraph } from "@/lib/schemas/recognized-plan-graph-schema";

const sampleGraph: RecognizedPlanGraph = {
  scale: { pixelsPerMeter: 40 },
  levels: [
    {
      name: "Level 01",
      walls: [
        { id: "wall-1", start: [0, 0], end: [400, 0], type: "external" },
        { id: "wall-2", start: [400, 0], end: [400, 320], type: "external" },
        { id: "wall-3", start: [400, 320], end: [0, 320], type: "external" },
        { id: "wall-4", start: [0, 320], end: [0, 0], type: "external" }
      ],
      openings: [{ id: "door-1", type: "door", center: [200, 0], width: 0.9 }],
      roomPolygons: [
        {
          id: "room-1",
          name: "Office",
          type: "office",
          zone: "semi_public",
          polygon: [
            [20, 20],
            [380, 20],
            [380, 300],
            [20, 300]
          ]
        }
      ],
      roomLabels: [],
      dimensionAnnotations: [{ text: "10 m", start: [0, 360], end: [400, 360] }]
    }
  ],
  warnings: []
};

describe("buildPlanVersionFromGraph", () => {
  it("converts recognized geometry into a PlanVersion draft", () => {
    const draft = buildPlanVersionFromGraph(sampleGraph, { fileName: "scan.png" });

    expect(draft.rooms).toHaveLength(1);
    expect(draft.rooms[0]?.name).toBe("Office");
    expect(draft.levels?.[0]?.walls.length).toBeGreaterThanOrEqual(4);
    expect(draft.levels?.[0]?.openings.length).toBe(1);
    expect(draft.overallBounds.width).toBeGreaterThan(8);
  });
});

describe("parseDxfToGraph", () => {
  it("extracts wall lines and room labels from DXF entities", () => {
    const dxf = `0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
A-WALL
10
0.0
20
0.0
11
5000.0
21
0.0
0
TEXT
8
A-ROOM
10
2500.0
20
2500.0
40
250.0
1
Office
0
ENDSEC
0
EOF`;

    const graph = parseDxfToGraph(dxf);

    expect(graph.levels[0]?.walls.length).toBeGreaterThan(0);
    expect(graph.levels[0]?.roomLabels.some((label) => label.name === "Office")).toBe(true);
  });
});
