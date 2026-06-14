import { initialProjectData } from "@/lib/evolab-data";
import { generateRuleBasedMep } from "@/lib/mep-router";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import type {
  AnalysisLayerId,
  CopilotFinding,
  MepLayout,
  PlanVersion,
  Point,
  Room
} from "@/lib/project-types";

const baseVersion = initialProjectData.versions[0];

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function shiftPolygon(points: Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

function getBounds(points: Point[]): Bounds {
  const raw = points.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  return {
    ...raw,
    width: Math.max(1, raw.maxX - raw.minX),
    height: Math.max(1, raw.maxY - raw.minY)
  };
}

function localizeOutline(points: Point[], bounds: Bounds): Point[] {
  return points.map(([x, y]) => [x - bounds.minX, y - bounds.minY]);
}

function rect(
  id: string,
  name: string,
  type: Room["type"],
  zone: Room["zone"],
  x: number,
  y: number,
  width: number,
  height: number,
  options: Partial<Room> = {}
): Room {
  return {
    id,
    name,
    type,
    zone,
    polygon: [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ],
    areaSqm: Math.round(width * height),
    ceilingHeight: options.ceilingHeight ?? (type === "lobby" ? 5.4 : type === "equipment_room" ? 3.6 : 3.3),
    orientation: options.orientation,
    doors: options.doors ?? [],
    windows: options.windows ?? [],
    needsDaylight: options.needsDaylight,
    needsPlumbing: options.needsPlumbing,
    adjacents: options.adjacents ?? []
  };
}

function addStandardOpenings(room: Room, doorWall: Room["doors"][number]["wall"], windowWall?: Room["windows"][number]["wall"]) {
  return {
    ...room,
    doors: room.doors.length ? room.doors : [{ wall: doorWall, position: 0.5, width: room.type === "lobby" ? 3.6 : 1.2 }],
    windows:
      windowWall && room.needsDaylight
        ? room.windows.length
          ? room.windows
          : [{ wall: windowWall, position: 0.5, width: Math.max(2.4, Math.min(10, Math.sqrt(room.areaSqm))) }]
        : room.windows
  };
}

function createCentralCoreLayout(bounds: Bounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const corridorW = Math.max(5, w * 0.14);
  const leftW = Math.max(12, w * 0.32);
  const corridorX = leftW;
  const rightX = corridorX + corridorW;
  const rightW = Math.max(10, w - rightX);
  const midY = h * 0.48;
  const serviceY = h * 0.78;

  return [
    rect("lobby-01", "Outpatient Lobby", "lobby", "public", 0, 0, leftW, midY, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01", "consult-01"]
    }),
    rect("corridor-01", "Central Medical Street", "corridor", "circulation", corridorX, 0, corridorW, h, {
      adjacents: ["lobby-01", "consult-01", "office-01", "core-01", "shaft-01", "equipment-01"]
    }),
    rect("consult-01", "Consultation Cluster", "consultation", "semi_public", rightX, 0, rightW, midY, {
      needsDaylight: true,
      needsPlumbing: true,
      orientation: "south",
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("office-01", "Clinical Offices", "office", "private", rightX, serviceY, rightW * 0.62, h - serviceY, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01", "equipment-01"]
    }),
    rect("core-01", "Stair Elevator Core", "elevator", "circulation", rightX + rightW * 0.62, midY, rightW * 0.22, serviceY - midY, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Service Shaft", "shaft", "service", rightX + rightW * 0.84, midY, rightW * 0.16, (serviceY - midY) * 0.58, {
      adjacents: ["consult-01", "core-01", "equipment-01"]
    }),
    rect("equipment-01", "Equipment Room", "equipment_room", "service", rightX + rightW * 0.62, serviceY, rightW * 0.38, h - serviceY, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01", "office-01"]
    })
  ];
}

function createDualCorridorLayout(bounds: Bounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const corridorH = Math.max(4.5, h * 0.13);
  const southH = Math.max(8, h * 0.34);
  const northY = southH + corridorH;
  const roomNorthY = northY + corridorH;
  const northH = Math.max(8, h - roomNorthY);
  const coreW = Math.max(7, w * 0.12);

  return [
    rect("lobby-01", "Public Lobby", "lobby", "public", 0, 0, w * 0.32, southH, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-south", "consult-01"]
    }),
    rect("consult-01", "Consultation South Bar", "consultation", "semi_public", w * 0.32, 0, w * 0.46, southH, {
      needsDaylight: true,
      needsPlumbing: true,
      orientation: "south",
      adjacents: ["corridor-south", "shaft-01"]
    }),
    rect("core-01", "Vertical Core", "elevator", "circulation", w - coreW, 0, coreW, southH, {
      adjacents: ["corridor-south", "corridor-north", "shaft-01"]
    }),
    rect("corridor-south", "South Corridor", "corridor", "circulation", 0, southH, w, corridorH, {
      adjacents: ["lobby-01", "consult-01", "core-01", "corridor-north"]
    }),
    rect("corridor-north", "North Corridor", "corridor", "circulation", 0, northY, w, corridorH, {
      adjacents: ["office-01", "equipment-01", "core-01", "corridor-south"]
    }),
    rect("office-01", "Clinical Offices", "office", "private", 0, roomNorthY, w * 0.56, northH, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-north"]
    }),
    rect("equipment-01", "Equipment Room", "equipment_room", "service", w * 0.56, roomNorthY, w * 0.26, northH, {
      needsPlumbing: true,
      adjacents: ["corridor-north", "shaft-01"]
    }),
    rect("shaft-01", "Service Shaft", "shaft", "service", w * 0.82, roomNorthY, w * 0.08, northH, {
      adjacents: ["equipment-01", "consult-01", "core-01"]
    })
  ];
}

function createServiceSpineLayout(bounds: Bounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const spineW = Math.max(8, w * 0.16);
  const publicW = Math.max(14, w * 0.34);
  const clinicalW = Math.max(12, w - publicW - spineW);
  const midY = h * 0.5;
  const coreH = Math.max(8, h * 0.24);
  const officeH = Math.max(5, h - midY - coreH);

  return [
    rect("lobby-01", "Public Arrival", "lobby", "public", 0, 0, publicW, h, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01", "consult-01"]
    }),
    rect("corridor-01", "Service Spine Corridor", "corridor", "circulation", publicW, 0, spineW, h, {
      adjacents: ["lobby-01", "consult-01", "office-01", "core-01", "shaft-01", "equipment-01"]
    }),
    rect("consult-01", "Consultation Bar", "consultation", "semi_public", publicW + spineW, 0, clinicalW, midY, {
      needsDaylight: true,
      needsPlumbing: true,
      orientation: "south",
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("office-01", "Back Office", "office", "private", publicW + spineW, midY, clinicalW * 0.62, officeH, {
      orientation: "north",
      adjacents: ["corridor-01", "equipment-01"]
    }),
    rect("core-01", "Core", "elevator", "circulation", publicW + spineW, h - coreH, clinicalW * 0.22, coreH, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Wet Shaft", "shaft", "service", publicW + spineW + clinicalW * 0.62, midY, clinicalW * 0.14, h - midY, {
      adjacents: ["consult-01", "equipment-01", "core-01"]
    }),
    rect("equipment-01", "Plant Equipment", "equipment_room", "service", publicW + spineW + clinicalW * 0.76, midY, clinicalW * 0.24, h - midY, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    })
  ];
}

function applyOpenings(rooms: Room[]) {
  return rooms.map((room) => {
    if (room.type === "corridor" || room.type === "shaft") {
      return room;
    }

    const doorWall = room.type === "lobby" ? "east" : "west";
    const windowWall = room.orientation === "north" ? "north" : "south";
    return addStandardOpenings(room, doorWall, windowWall);
  });
}

export function createMockPlanVersions(outline?: Point[], projectType = "healthcare"): PlanVersion[] {
  const sourceOutline = outline && outline.length >= 3 ? outline : baseVersion.outline;
  const bounds = getBounds(sourceOutline);
  const localOutline = localizeOutline(sourceOutline, bounds);
  const layouts = [
    {
      strategy: "Central Core",
      rooms: createCentralCoreLayout(bounds),
      topology: {
        circulation: "Single central medical street links public arrival, clinical rooms and service rooms.",
        core: "Vertical core is placed near the middle-right clinical/service zone.",
        daylight: "Public and clinical rooms sit on external south or north edges.",
        plumbing: "Wet consultation and equipment rooms cluster around one shaft."
      }
    },
    {
      strategy: "Dual Corridor",
      rooms: createDualCorridorLayout(bounds),
      topology: {
        circulation: "Two connected corridors separate public south rooms and staff/service north rooms.",
        core: "Core sits at the east end and connects both corridor bands.",
        daylight: "Consultation and office bars use opposite external edges.",
        plumbing: "Shaft is paired with equipment and close to consultation rooms."
      }
    },
    {
      strategy: "Service Spine",
      rooms: createServiceSpineLayout(bounds),
      topology: {
        circulation: "A vertical service spine separates public arrival from clinical and back-of-house spaces.",
        core: "Core is embedded in the spine for compact egress.",
        daylight: "Large public and clinical zones keep external exposure.",
        plumbing: "Shaft and equipment room form a compact service cluster."
      }
    }
  ];

  return layouts.map((layout, index) =>
    postProcessPlanVersion({
      id: `mock-${projectType}-${index + 1}`,
      label: `Scheme ${String.fromCharCode(65 + index)} / ${layout.strategy}`,
      createdAt: new Date().toISOString(),
      metadata: {
        strategy: layout.strategy,
        topology: layout.topology
      },
      outline: localOutline,
      overallBounds: {
        width: bounds.width,
        height: bounds.height
      },
      rooms: applyOpenings(layout.rooms)
    })
  );
}

export function createMockAnalyzedVersion(): { version: PlanVersion; confidence: number; warnings: string[] } {
  return {
    version: postProcessPlanVersion({
      ...baseVersion,
      id: "analyzed-plan-001",
      label: "Analyzed Plan / Drawing Import",
      createdAt: new Date().toISOString()
    }),
    confidence: 0.78,
    warnings: [
      "No real drawing recognition was run. EvoLab returned mock structured plan data.",
      "Door, window and text annotation confidence values are examples."
    ]
  };
}

export function createMockModifiedVersion(currentVersion: PlanVersion, userRequest: string) {
  const shouldMoveCore = /\u6838\u5fc3|core|\u5317/i.test(userRequest);
  const version: PlanVersion = postProcessPlanVersion({
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
    })
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
  return generateRuleBasedMep(version);
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
