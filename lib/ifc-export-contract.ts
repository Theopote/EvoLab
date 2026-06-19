import type { OpeningElement, PlanVersion, Point, Room, Wall } from "@/lib/project-types";
import { resolveLevelOutline, resolveLevelRooms } from "@/lib/level-rooms";

export interface IfcExportPayload {
  schema: "IFC4";
  generator: "EvoLab";
  handoff: {
    recommendedEngine: "IfcOpenShell";
    endpointContract: "POST PlanVersion JSON to a backend service that returns application/x-step .ifc bytes.";
  };
  project: {
    id: string;
    name: string;
  };
  site: {
    boundary: Point[];
  };
  building: {
    id: string;
    name: string;
  };
  storeys: IfcStoreyPayload[];
  notes: string[];
}

export interface IfcStoreyPayload {
  id: string;
  name: string;
  elevation: number;
  height: number;
  floor: {
    id: string;
    outline: Point[];
    thickness: number;
  };
  spaces: IfcSpacePayload[];
  walls: IfcWallPayload[];
  openings: IfcOpeningPayload[];
}

export interface IfcSpacePayload {
  id: string;
  name: string;
  roomType: Room["type"];
  zone: Room["zone"];
  footprint: Point[];
  areaSqm: number;
  height: number;
}

export interface IfcWallPayload {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
  predefinedType: "EXTERNAL" | "INTERNAL" | "PARTITIONING" | "USERDEFINED";
  relatedSpaceIds: string[];
}

export interface IfcOpeningPayload {
  id: string;
  wallId: string;
  type: OpeningElement["type"];
  center: Point;
  width: number;
  height: number;
  sillHeight?: number;
}

function wallPredefinedType(wall: Wall): IfcWallPayload["predefinedType"] {
  if (wall.type === "external") {
    return "EXTERNAL";
  }

  if (wall.type === "internal" || wall.type === "core") {
    return "INTERNAL";
  }

  if (wall.type === "partition") {
    return "PARTITIONING";
  }

  return "USERDEFINED";
}

export function createIfcExportPayload(version: PlanVersion): IfcExportPayload {
  const groups = version.standardFloorGroups;

  return {
    schema: "IFC4",
    generator: "EvoLab",
    handoff: {
      recommendedEngine: "IfcOpenShell",
      endpointContract: "POST PlanVersion JSON to a backend service that returns application/x-step .ifc bytes."
    },
    project: {
      id: version.id,
      name: version.label
    },
    site: {
      boundary: version.outline
    },
    building: {
      id: version.building.id,
      name: version.building.name
    },
    storeys: version.levels.map((level) => ({
      id: level.id,
      name: level.name,
      elevation: level.elevation,
      height: level.height,
      floor: {
        id: level.floor?.id ?? `${level.id}-floor`,
        outline: level.floor?.outline ?? version.outline,
        thickness: level.floor?.thickness ?? 0.18
      },
      spaces: level.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        roomType: room.type,
        zone: room.zone,
        footprint: room.polygon,
        areaSqm: room.areaSqm,
        height: room.ceilingHeight
      })),
      walls: level.walls.map((wall) => ({
        id: wall.id,
        start: wall.start,
        end: wall.end,
        thickness: wall.thickness,
        height: wall.height,
        predefinedType: wallPredefinedType(wall),
        relatedSpaceIds: wall.roomIds
      })),
      openings: level.openings.map((opening) => ({
        id: opening.id,
        wallId: opening.wallId,
        type: opening.type,
        center: opening.center,
        width: opening.width,
        height: opening.height,
        sillHeight: opening.sillHeight
      }))
    })),
    notes: [
      "This is an IFC handoff payload, not a STEP/IFC file.",
      "A production exporter should create IfcProject, IfcSite, IfcBuilding, IfcBuildingStorey, IfcSpace, IfcSlab, IfcWall, IfcOpeningElement, IfcDoor and IfcWindow entities.",
      "Use wall/opening ids as stable references when cutting openings in IfcOpenShell."
    ]
  };
}
