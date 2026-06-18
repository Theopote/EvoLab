import { initialProjectData } from "@/lib/evolab-data";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import type { PlanVersion, Point, Room } from "@/lib/project-types";
import type { TopologyLayoutKind, TypologyPack } from "@/lib/typology/types";

const baseVersion = initialProjectData.versions[0];

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

function getBounds(points: Point[]): LayoutBounds {
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

function localizeOutline(points: Point[], bounds: LayoutBounds): Point[] {
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

function healthcareCentralCore(bounds: LayoutBounds): Room[] {
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

function healthcareDualCorridor(bounds: LayoutBounds): Room[] {
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

function healthcareServiceSpine(bounds: LayoutBounds): Room[] {
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

function officeOpenPlan(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const corridorW = Math.max(4.5, w * 0.1);
  const lobbyW = Math.max(12, w * 0.22);
  const coreW = Math.max(8, w * 0.14);
  const workspaceX = lobbyW + corridorW;
  const workspaceW = Math.max(14, w - workspaceX - coreW);
  const midY = h * 0.55;

  return [
    rect("lobby-01", "Reception Lobby", "lobby", "public", 0, 0, lobbyW, h, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("corridor-01", "Office Street", "corridor", "circulation", lobbyW, 0, corridorW, h, {
      adjacents: ["lobby-01", "office-01", "office-02", "core-01", "equipment-01"]
    }),
    rect("office-01", "Open Workspace", "office", "private", workspaceX, 0, workspaceW, midY, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01", "office-02"]
    }),
    rect("office-02", "Meeting Rooms", "office", "semi_public", workspaceX, midY, workspaceW * 0.68, h - midY, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01", "office-01"]
    }),
    rect("core-01", "Vertical Core", "elevator", "circulation", w - coreW, 0, coreW, h * 0.42, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Service Shaft", "shaft", "service", w - coreW, h * 0.42, coreW * 0.45, h * 0.18, {
      adjacents: ["core-01", "equipment-01"]
    }),
    rect("equipment-01", "Pantry / IT", "equipment_room", "service", w - coreW, h * 0.6, coreW, h * 0.4, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    })
  ];
}

function officeSideCore(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const coreW = Math.max(9, w * 0.16);
  const corridorW = Math.max(4.5, w * 0.1);
  const lobbyH = Math.max(10, h * 0.28);
  const workspaceW = Math.max(12, w - coreW - corridorW);

  return [
    rect("lobby-01", "Visitor Lobby", "lobby", "public", 0, 0, workspaceW, lobbyH, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01", "office-01"]
    }),
    rect("corridor-01", "Perimeter Corridor", "corridor", "circulation", workspaceW, 0, corridorW, h, {
      adjacents: ["lobby-01", "office-01", "office-02", "core-01", "equipment-01"]
    }),
    rect("office-01", "Open Office", "office", "private", 0, lobbyH, workspaceW, h - lobbyH, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["lobby-01", "corridor-01"]
    }),
    rect("office-02", "Focus Rooms", "office", "semi_public", workspaceW + corridorW, 0, w - workspaceW - corridorW - coreW, h * 0.45, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01"]
    }),
    rect("core-01", "Side Core", "elevator", "circulation", w - coreW, 0, coreW, h * 0.5, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Wet Shaft", "shaft", "service", w - coreW, h * 0.5, coreW * 0.5, h * 0.2, {
      adjacents: ["core-01", "equipment-01"]
    }),
    rect("equipment-01", "Support Zone", "equipment_room", "service", w - coreW, h * 0.7, coreW, h * 0.3, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    })
  ];
}

function officeServiceSpine(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const spineW = Math.max(7, w * 0.14);
  const lobbyW = Math.max(12, w * 0.28);
  const officeW = Math.max(12, w - lobbyW - spineW);
  const midY = h * 0.52;

  return [
    rect("lobby-01", "Arrival Lounge", "lobby", "public", 0, 0, lobbyW, h, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("corridor-01", "Support Spine", "corridor", "circulation", lobbyW, 0, spineW, h, {
      adjacents: ["lobby-01", "office-01", "office-02", "core-01", "equipment-01"]
    }),
    rect("office-01", "Workspace Bar", "office", "private", lobbyW + spineW, 0, officeW, midY, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01", "office-02"]
    }),
    rect("office-02", "Collaboration Zone", "office", "semi_public", lobbyW + spineW, midY, officeW * 0.7, h - midY, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01", "office-01"]
    }),
    rect("core-01", "Core", "elevator", "circulation", lobbyW + spineW + officeW * 0.7, midY, officeW * 0.3, h - midY, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("equipment-01", "Pantry", "equipment_room", "service", lobbyW + spineW + officeW * 0.7, h * 0.72, officeW * 0.3, h * 0.28, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Shaft", "shaft", "service", lobbyW + spineW + officeW * 0.85, midY, officeW * 0.15, h * 0.22, {
      adjacents: ["core-01", "equipment-01"]
    })
  ];
}

function schoolClassroomWing(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const corridorW = Math.max(5, w * 0.12);
  const lobbyH = Math.max(10, h * 0.22);
  const coreW = Math.max(8, w * 0.14);
  const classroomX = corridorW;
  const classroomW = Math.max(14, w - classroomX - coreW);

  return [
    rect("lobby-01", "Main Entrance", "lobby", "public", 0, 0, w - coreW, lobbyH, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("corridor-01", "Teaching Corridor", "corridor", "circulation", 0, lobbyH, corridorW, h - lobbyH, {
      adjacents: ["lobby-01", "classroom-01", "office-01", "bathroom-01", "core-01"]
    }),
    rect("classroom-01", "Classroom Wing", "other", "private", classroomX, lobbyH, classroomW, h * 0.62, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("office-01", "Staff Office", "office", "semi_public", classroomX, lobbyH + h * 0.62, classroomW * 0.55, h - lobbyH - h * 0.62, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01", "equipment-01"]
    }),
    rect("bathroom-01", "Restrooms", "bathroom", "service", classroomX + classroomW * 0.55, lobbyH + h * 0.62, classroomW * 0.25, h - lobbyH - h * 0.62, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("equipment-01", "Storage", "equipment_room", "service", classroomX + classroomW * 0.8, lobbyH + h * 0.62, classroomW * 0.2, h - lobbyH - h * 0.62, {
      adjacents: ["corridor-01", "office-01"]
    }),
    rect("core-01", "Stair Core", "stair", "circulation", w - coreW, 0, coreW, h * 0.45, {
      adjacents: ["corridor-01", "lobby-01", "shaft-01"]
    }),
    rect("shaft-01", "Service Shaft", "shaft", "service", w - coreW, h * 0.45, coreW * 0.45, h * 0.2, {
      adjacents: ["bathroom-01", "core-01"]
    })
  ];
}

function schoolHubSpine(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const spineH = Math.max(5, h * 0.12);
  const lobbyH = Math.max(10, h * 0.24);
  const coreW = Math.max(8, w * 0.12);
  const northY = lobbyH + spineH;

  return [
    rect("lobby-01", "Entry Hall", "lobby", "public", 0, 0, w, lobbyH, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("corridor-01", "Hub Spine", "corridor", "circulation", 0, lobbyH, w, spineH, {
      adjacents: ["lobby-01", "classroom-01", "office-01", "core-01", "bathroom-01"]
    }),
    rect("classroom-01", "Classroom Bar", "other", "private", 0, northY, w * 0.62, h - northY, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01"]
    }),
    rect("office-01", "Faculty Office", "office", "semi_public", w * 0.62, northY, w * 0.26, h - northY, {
      needsDaylight: true,
      orientation: "east",
      adjacents: ["corridor-01", "equipment-01"]
    }),
    rect("bathroom-01", "Restrooms", "bathroom", "service", w * 0.88, northY, w * 0.12 - coreW * 0.5, (h - northY) * 0.45, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("equipment-01", "Janitor", "equipment_room", "service", w * 0.88, northY + (h - northY) * 0.45, w * 0.12 - coreW * 0.5, (h - northY) * 0.55, {
      adjacents: ["office-01", "shaft-01"]
    }),
    rect("core-01", "Core", "elevator", "circulation", w - coreW, northY, coreW, h - northY, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Shaft", "shaft", "service", w - coreW * 0.55, northY + (h - northY) * 0.2, coreW * 0.55, (h - northY) * 0.25, {
      adjacents: ["bathroom-01", "core-01", "equipment-01"]
    })
  ];
}

function schoolCentralCore(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const corridorW = Math.max(5, w * 0.13);
  const lobbyW = Math.max(12, w * 0.3);
  const coreW = Math.max(8, w * 0.15);
  const classroomX = lobbyW + corridorW;
  const classroomW = Math.max(12, w - classroomX - coreW);
  const midY = h * 0.5;

  return [
    rect("lobby-01", "School Lobby", "lobby", "public", 0, 0, lobbyW, h, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("corridor-01", "Main Corridor", "corridor", "circulation", lobbyW, 0, corridorW, h, {
      adjacents: ["lobby-01", "classroom-01", "office-01", "core-01", "bathroom-01"]
    }),
    rect("classroom-01", "Classrooms", "other", "private", classroomX, 0, classroomW, midY, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("office-01", "Admin Office", "office", "semi_public", classroomX, midY, classroomW * 0.6, h - midY, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01", "equipment-01"]
    }),
    rect("bathroom-01", "Restrooms", "bathroom", "service", classroomX + classroomW * 0.6, midY, classroomW * 0.25, h - midY, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("equipment-01", "Storage", "equipment_room", "service", classroomX + classroomW * 0.85, midY, classroomW * 0.15, h - midY, {
      adjacents: ["corridor-01", "office-01"]
    }),
    rect("core-01", "Central Core", "elevator", "circulation", w - coreW, 0, coreW, h * 0.48, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Service Shaft", "shaft", "service", w - coreW, h * 0.48, coreW * 0.5, h * 0.2, {
      adjacents: ["bathroom-01", "core-01"]
    })
  ];
}

function residentialCentralCore(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const corridorW = Math.max(4, w * 0.1);
  const lobbyW = Math.max(10, w * 0.24);
  const coreW = Math.max(8, w * 0.14);
  const unitX = lobbyW + corridorW;
  const unitW = Math.max(12, w - unitX - coreW);
  const midY = h * 0.52;

  return [
    rect("lobby-01", "Entry Lobby", "lobby", "public", 0, 0, lobbyW, h, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("corridor-01", "Unit Corridor", "corridor", "circulation", lobbyW, 0, corridorW, h, {
      adjacents: ["lobby-01", "living-01", "bedroom-01", "core-01", "kitchen-01"]
    }),
    rect("living-01", "Living Room", "living_room", "private", unitX, 0, unitW, midY, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01", "kitchen-01"]
    }),
    rect("bedroom-01", "Bedroom", "bedroom", "private", unitX, midY, unitW * 0.62, h - midY, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01"]
    }),
    rect("kitchen-01", "Kitchen", "kitchen", "service", unitX + unitW * 0.62, midY, unitW * 0.22, h - midY, {
      needsPlumbing: true,
      adjacents: ["living-01", "shaft-01"]
    }),
    rect("bathroom-01", "Bathroom", "bathroom", "service", unitX + unitW * 0.84, midY, unitW * 0.16, h - midY, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("core-01", "Vertical Core", "elevator", "circulation", w - coreW, 0, coreW, h * 0.5, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Wet Shaft", "shaft", "service", w - coreW, h * 0.5, coreW * 0.5, h * 0.22, {
      adjacents: ["kitchen-01", "bathroom-01", "core-01"]
    })
  ];
}

function residentialDualCorridor(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const corridorH = Math.max(4, h * 0.11);
  const southH = Math.max(8, h * 0.36);
  const northY = southH + corridorH;
  const roomNorthY = northY + corridorH;
  const northH = Math.max(8, h - roomNorthY);
  const coreW = Math.max(7, w * 0.12);

  return [
    rect("lobby-01", "Entry", "lobby", "public", 0, 0, w * 0.3, southH, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-south", "living-01"]
    }),
    rect("living-01", "Living Zone", "living_room", "private", w * 0.3, 0, w * 0.5, southH, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-south", "kitchen-01"]
    }),
    rect("core-01", "Core", "elevator", "circulation", w - coreW, 0, coreW, southH, {
      adjacents: ["corridor-south", "corridor-north", "shaft-01"]
    }),
    rect("corridor-south", "South Corridor", "corridor", "circulation", 0, southH, w, corridorH, {
      adjacents: ["lobby-01", "living-01", "core-01", "corridor-north"]
    }),
    rect("corridor-north", "North Corridor", "corridor", "circulation", 0, northY, w, corridorH, {
      adjacents: ["bedroom-01", "bathroom-01", "core-01", "corridor-south"]
    }),
    rect("bedroom-01", "Bedrooms", "bedroom", "private", 0, roomNorthY, w * 0.58, northH, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-north"]
    }),
    rect("kitchen-01", "Kitchen", "kitchen", "service", w * 0.58, roomNorthY, w * 0.22, northH, {
      needsPlumbing: true,
      adjacents: ["living-01", "shaft-01"]
    }),
    rect("bathroom-01", "Bathroom", "bathroom", "service", w * 0.8, roomNorthY, w * 0.1, northH, {
      needsPlumbing: true,
      adjacents: ["corridor-north", "shaft-01"]
    }),
    rect("shaft-01", "Shaft", "shaft", "service", w * 0.9, roomNorthY, w * 0.1 - coreW * 0.5, northH, {
      adjacents: ["kitchen-01", "bathroom-01", "core-01"]
    })
  ];
}

function residentialServiceSpine(bounds: LayoutBounds): Room[] {
  const w = bounds.width;
  const h = bounds.height;
  const spineW = Math.max(6, w * 0.12);
  const lobbyW = Math.max(10, w * 0.26);
  const unitW = Math.max(12, w - lobbyW - spineW);
  const midY = h * 0.5;

  return [
    rect("lobby-01", "Lobby", "lobby", "public", 0, 0, lobbyW, h, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01"]
    }),
    rect("corridor-01", "Service Spine", "corridor", "circulation", lobbyW, 0, spineW, h, {
      adjacents: ["lobby-01", "living-01", "bedroom-01", "core-01", "kitchen-01"]
    }),
    rect("living-01", "Living", "living_room", "private", lobbyW + spineW, 0, unitW, midY, {
      needsDaylight: true,
      orientation: "south",
      adjacents: ["corridor-01", "kitchen-01"]
    }),
    rect("bedroom-01", "Bedroom", "bedroom", "private", lobbyW + spineW, midY, unitW * 0.65, h - midY, {
      needsDaylight: true,
      orientation: "north",
      adjacents: ["corridor-01"]
    }),
    rect("kitchen-01", "Kitchen", "kitchen", "service", lobbyW + spineW + unitW * 0.65, midY, unitW * 0.2, h - midY, {
      needsPlumbing: true,
      adjacents: ["living-01", "shaft-01"]
    }),
    rect("bathroom-01", "Bathroom", "bathroom", "service", lobbyW + spineW + unitW * 0.85, midY, unitW * 0.15, h - midY, {
      needsPlumbing: true,
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("core-01", "Core", "elevator", "circulation", lobbyW + spineW + unitW * 0.65, h * 0.72, unitW * 0.35, h * 0.28, {
      adjacents: ["corridor-01", "shaft-01"]
    }),
    rect("shaft-01", "Wet Shaft", "shaft", "service", lobbyW + spineW + unitW * 0.8, h * 0.55, unitW * 0.2, h * 0.17, {
      adjacents: ["kitchen-01", "bathroom-01", "core-01"]
    })
  ];
}

const LAYOUT_BUILDERS: Record<TopologyLayoutKind, (bounds: LayoutBounds) => Room[]> = {
  central_core: healthcareCentralCore,
  dual_corridor: healthcareDualCorridor,
  service_spine: healthcareServiceSpine,
  open_plan: officeOpenPlan,
  side_core: officeSideCore,
  classroom_wing: schoolClassroomWing,
  hub_spine: schoolHubSpine
};

const PACK_LAYOUT_OVERRIDES: Partial<Record<TypologyPack["id"], Partial<Record<TopologyLayoutKind, (bounds: LayoutBounds) => Room[]>>>> = {
  office: {
    central_core: officeSideCore,
    dual_corridor: officeOpenPlan,
    service_spine: officeServiceSpine,
    open_plan: officeOpenPlan,
    side_core: officeSideCore
  },
  school: {
    central_core: schoolCentralCore,
    dual_corridor: schoolHubSpine,
    service_spine: schoolClassroomWing,
    classroom_wing: schoolClassroomWing,
    hub_spine: schoolHubSpine
  },
  residential: {
    central_core: residentialCentralCore,
    dual_corridor: residentialDualCorridor,
    service_spine: residentialServiceSpine
  }
};

export function createLayoutRooms(pack: TypologyPack, layoutKind: TopologyLayoutKind, bounds: LayoutBounds) {
  const override = PACK_LAYOUT_OVERRIDES[pack.id]?.[layoutKind];
  const builder = override ?? LAYOUT_BUILDERS[layoutKind] ?? healthcareCentralCore;
  return builder(bounds);
}

export function createMockPlanVersionsFromPack(pack: TypologyPack, outline?: Point[]): PlanVersion[] {
  const sourceOutline = outline && outline.length >= 3 ? outline : baseVersion.outline;
  const bounds = getBounds(sourceOutline);
  const localOutline = localizeOutline(sourceOutline, bounds);

  return pack.topology.strategies.map((strategy, index) => {
    const rooms = applyOpenings(createLayoutRooms(pack, strategy.layoutKind, bounds));

    return postProcessPlanVersion({
      id: `mock-${pack.id}-${index + 1}`,
      label: `Scheme ${String.fromCharCode(65 + index)} / ${strategy.label}`,
      createdAt: new Date().toISOString(),
      metadata: {
        strategy: strategy.label,
        topology: {
          circulation: strategy.circulation,
          core: strategy.core,
          daylight: strategy.daylight,
          plumbing: strategy.plumbing
        }
      },
      outline: localOutline,
      overallBounds: {
        width: bounds.width,
        height: bounds.height
      },
      rooms
    });
  });
}
