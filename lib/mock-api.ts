import { normalizePlanVersion } from "@/lib/architecture-model";
import { initialProjectData } from "@/lib/evolab-data";
import type {
  AnalysisLayerId,
  CopilotFinding,
  MepLayout,
  MepSystemType,
  PlanVersion,
  Point
} from "@/lib/project-types";

const baseVersion = initialProjectData.versions[0];

function shiftPolygon(points: Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

function withScores(version: PlanVersion, index: number): PlanVersion {
  return {
    ...version,
    scores: {
      areaEfficiency: 82 + index * 3,
      circulationScore: 76 + index * 4,
      daylightScore: 80 + index * 2,
      mepAlignmentScore: 74 + index * 5,
      riskCount: Math.max(0, 3 - index)
    }
  };
}

export function createMockPlanVersions(outline?: Point[], projectType = "healthcare"): PlanVersion[] {
  const sourceOutline = outline && outline.length >= 3 ? outline : baseVersion.outline;
  const bounds = sourceOutline.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  return ["Central Core", "Dual Corridor", "Service Spine"].map((strategy, index) => {
    const offset = index * 1.8;
    return normalizePlanVersion(
      withScores(
        {
        ...baseVersion,
        id: `mock-${projectType}-${index + 1}`,
        label: `Scheme ${String.fromCharCode(65 + index)} / ${strategy}`,
        createdAt: new Date().toISOString(),
        outline: sourceOutline,
        overallBounds: {
          width: Math.max(1, bounds.maxX - bounds.minX),
          height: Math.max(1, bounds.maxY - bounds.minY)
        },
        rooms: baseVersion.rooms.map((room) => ({
          ...room,
          id: `${room.id}-v${index + 1}`,
          polygon: index === 0 ? room.polygon : shiftPolygon(room.polygon, offset, index % 2 === 0 ? 0 : -offset),
          areaSqm: Math.round(room.areaSqm * (1 + index * 0.035))
        }))
      },
      index
      )
    );
  });
}

export function createMockAnalyzedVersion(): { version: PlanVersion; confidence: number; warnings: string[] } {
  return {
    version: normalizePlanVersion({
      ...baseVersion,
      id: "analyzed-plan-001",
      label: "Analyzed Plan / Drawing Import",
      createdAt: new Date().toISOString()
    }),
    confidence: 0.78,
    warnings: ["No real drawing recognition was run. EvoLab returned mock structured plan data.", "Door, window and text annotation confidence values are examples."]
  };
}

export function createMockModifiedVersion(currentVersion: PlanVersion, userRequest: string) {
  const shouldMoveCore = /\u6838\u5fc3|core|\u5317/i.test(userRequest);
  const version: PlanVersion = normalizePlanVersion({
    ...currentVersion,
    id: `${currentVersion.id}-mod-${Date.now()}`,
    label: `${currentVersion.label} / Copilot Revision`,
    createdAt: new Date().toISOString(),
    parentVersionId: currentVersion.id,
    rooms: currentVersion.rooms.map((room) => {
      if (shouldMoveCore && (room.type === "elevator" || room.type === "stair" || room.type === "shaft")) {
        return {
          ...room,
          polygon: shiftPolygon(room.polygon, 0, -4)
        };
      }

      return room;
    }),
    scores: {
      areaEfficiency: Math.min(100, (currentVersion.scores?.areaEfficiency ?? 80) + 1),
      circulationScore: Math.min(100, (currentVersion.scores?.circulationScore ?? 75) + 4),
      daylightScore: currentVersion.scores?.daylightScore ?? 80,
      mepAlignmentScore: Math.min(100, (currentVersion.scores?.mepAlignmentScore ?? 72) + 3),
      riskCount: Math.max(0, (currentVersion.scores?.riskCount ?? 2) - 1)
    }
  });

  const findings: CopilotFinding[] = [
    {
      id: "finding-egress",
      tone: "success",
      text: "A complete editable plan version was generated from the request.",
      sub: "Plan, model, analysis and quantity modules can keep sharing this PlanVersion.",
      actions: [{ id: "recalculate-areas", label: "Recalculate areas" }]
    },
    {
      id: "finding-risk",
      tone: version.scores?.riskCount ? "warning" : "success",
      text: version.scores?.riskCount ? "Some compliance risks still need later review." : "No high-risk item was found by the mock rules.",
      actions: [{ id: "optimize-egress", label: "Optimize egress" }]
    }
  ];

  return { version, findings };
}

export function createMockMep(version: PlanVersion): { mep: MepLayout; findings: CopilotFinding[] } {
  const shaftRooms = version.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const corridor = version.rooms.find((room) => room.type === "corridor");
  const shaftPoint: Point = shaftRooms[0]?.polygon[0] ?? [version.overallBounds.width * 0.72, version.overallBounds.height * 0.5];
  const trunkStart: Point = corridor?.polygon[0] ?? [10, 10];
  const systems: MepSystemType[] = ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "elv", "fire"];

  return {
    mep: {
      shafts: [
        {
          id: "mep-shaft-01",
          position: shaftPoint,
          systems
        }
      ],
      routes: systems.map((system, index) => ({
        id: `route-${system}`,
        system,
        path: [
          [trunkStart[0], trunkStart[1] + index],
          [shaftPoint[0], trunkStart[1] + index],
          shaftPoint
        ],
        connectsRoomIds: version.rooms
          .filter((room) => room.needsPlumbing || room.type === "equipment_room" || room.type === "shaft")
          .map((room) => room.id)
      }))
    },
    findings: [
      {
        id: "mep-alignment",
        tone: "info",
        text: "Concept-level MEP shafts and trunk routes were generated.",
        sub: "Trunks prefer corridor routes and connect equipment rooms, shafts and wet rooms."
      }
    ]
  };
}

export function createMockDiagram(layers: AnalysisLayerId[]) {
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420"><rect width="720" height="420" fill="#0c1117"/><text x="32" y="48" fill="#9fb3c8" font-family="Arial" font-size="22">EvoLab analysis overlay</text></svg>`,
    overlays: {
      layers,
      rooms: baseVersion.rooms.map((room) => ({
        roomId: room.id,
        zone: room.zone,
        polygon: room.polygon
      }))
    }
  };
}
