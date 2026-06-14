import type { FunctionZone, OpeningElement, PlanVersion, Point, Room, RoomType, Wall } from "@/lib/project-types";

export interface QuantityRow {
  id: string;
  label: string;
  value: number;
  unit: string;
  basis: string;
}

export interface QuantityResult {
  rows: QuantityRow[];
  areaByZone: Record<FunctionZone, number>;
  areaByRoomType: Partial<Record<RoomType, number>>;
  summary: {
    grossArea: number;
    netUsableArea: number;
    externalWallLength: number;
    internalWallLength: number;
    wallArea: number;
    doorCount: number;
    windowCount: number;
    slabArea: number;
    roofArea: number;
    curtainWallOrWindowArea: number;
  };
}

export interface ComplianceItem {
  id: string;
  title: string;
  status: "success" | "warning";
  message: string;
  basis: string;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function polygonPerimeter(points: Point[]) {
  return points.reduce((total, point, index) => total + distance(point, points[(index + 1) % points.length]), 0);
}

function wallLength(wall: Wall) {
  return distance(wall.start, wall.end);
}

function polygonArea(points: Point[]) {
  const area = points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return total + x * nextY - nextX * y;
  }, 0);

  return Math.abs(area) / 2;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function nearestDistanceToRooms(room: Room, targets: Room[]) {
  if (targets.length === 0) {
    return Infinity;
  }

  const roomCenter = centroid(room);
  return Math.min(...targets.map((target) => distance(roomCenter, centroid(target))));
}

function maxDistanceToCore(version: PlanVersion) {
  const coreRooms = version.rooms.filter((room) => ["stair", "elevator", "shaft"].includes(room.type));
  const corePoint = coreRooms[0] ? centroid(coreRooms[0]) : [version.overallBounds.width / 2, version.overallBounds.height / 2] as Point;

  return Math.max(...version.rooms.map((room) => distance(centroid(room), corePoint)));
}

function activeLevel(version: PlanVersion) {
  return version.levels[0];
}

function roomOpenings(room: Room, openings: OpeningElement[], type: OpeningElement["type"]) {
  return openings.filter((opening) => opening.type === type && opening.roomIds?.includes(room.id));
}

export function calculateQuantities(version: PlanVersion): QuantityResult {
  const level = activeLevel(version);
  const walls = level?.walls ?? [];
  const openings = level?.openings ?? [];
  const grossArea = version.rooms.reduce((total, room) => total + room.areaSqm, 0);
  const netUsableArea = version.rooms
    .filter((room) => room.zone !== "circulation" && room.type !== "shaft")
    .reduce((total, room) => total + room.areaSqm, 0);
  const outlineArea = polygonArea(version.outline);
  const externalWallLength = walls.length
    ? walls
        .filter((wall) => wall.type === "external")
        .reduce((total, wall) => total + wallLength(wall), 0)
    : polygonPerimeter(version.outline);
  const roomPerimeterTotal = version.rooms.reduce((total, room) => total + polygonPerimeter(room.polygon), 0);
  const internalWallLength = walls.length
    ? walls
        .filter((wall) => wall.type === "internal" || wall.type === "partition" || wall.type === "core")
        .reduce((total, wall) => total + wallLength(wall), 0)
    : Math.max(0, (roomPerimeterTotal - externalWallLength) / 2);
  const averageWallHeight =
    version.rooms.reduce((total, room) => total + room.ceilingHeight, 0) / Math.max(1, version.rooms.length);
  const wallArea = walls.length
    ? walls.reduce((total, wall) => total + wallLength(wall) * wall.height, 0)
    : (externalWallLength + internalWallLength) * averageWallHeight;
  const doorCount = openings.length
    ? openings.filter((opening) => opening.type === "door").length
    : version.rooms.reduce((total, room) => total + room.doors.length, 0);
  const windowCount = openings.length
    ? openings.filter((opening) => opening.type === "window").length
    : version.rooms.reduce((total, room) => total + room.windows.length, 0);
  const slabArea = outlineArea || grossArea;
  const roofArea = slabArea;
  const curtainWallOrWindowArea = openings.length
    ? openings
        .filter((opening) => opening.type === "window")
        .reduce((total, opening) => total + opening.width * opening.height, 0)
    : version.rooms.reduce(
        (total, room) => total + room.windows.reduce((windowTotal, opening) => windowTotal + opening.width * 1.8, 0),
        0
      );

  const areaByZone = version.rooms.reduce(
    (acc, room) => {
      acc[room.zone] += room.areaSqm;
      return acc;
    },
    {
      public: 0,
      semi_public: 0,
      private: 0,
      service: 0,
      circulation: 0
    } satisfies Record<FunctionZone, number>
  );

  const areaByRoomType = version.rooms.reduce<Partial<Record<RoomType, number>>>((acc, room) => {
    acc[room.type] = (acc[room.type] ?? 0) + room.areaSqm;
    return acc;
  }, {});

  const rows: QuantityRow[] = [
    { id: "gross-area", label: "Gross building area", value: grossArea, unit: "sqm", basis: "Sum of Room.areaSqm" },
    {
      id: "net-area",
      label: "Net usable area",
      value: netUsableArea,
      unit: "sqm",
      basis: "Rooms excluding circulation and shafts"
    },
    {
      id: "external-wall-length",
      label: "External wall length",
      value: externalWallLength,
      unit: "m",
      basis: walls.length ? "Sum of Level.walls where type = external" : "Perimeter of PlanVersion.outline"
    },
    {
      id: "internal-wall-length",
      label: walls.length ? "Internal wall length" : "Internal wall length estimate",
      value: internalWallLength,
      unit: "m",
      basis: walls.length ? "Sum of Level.walls where type = internal, partition or core" : "(Sum room perimeters - outline perimeter) / 2"
    },
    {
      id: "wall-area",
      label: walls.length ? "Wall area" : "Wall area estimate",
      value: wallArea,
      unit: "sqm",
      basis: walls.length ? "Sum of wall length * wall height" : "(External + internal wall length) * average ceiling height"
    },
    { id: "doors", label: "Door count", value: doorCount, unit: "pcs", basis: openings.length ? "Level.openings where type = door" : "Sum of room.doors" },
    { id: "windows", label: "Window count", value: windowCount, unit: "pcs", basis: openings.length ? "Level.openings where type = window" : "Sum of room.windows" },
    { id: "slab-area", label: "Floor slab area", value: slabArea, unit: "sqm", basis: "Outline polygon area" },
    { id: "roof-area", label: "Roof area", value: roofArea, unit: "sqm", basis: "Assume roof equals outline area" },
    {
      id: "curtain-window-area",
      label: "Curtain wall / window area estimate",
      value: curtainWallOrWindowArea,
      unit: "sqm",
      basis: openings.length ? "Window OpeningElement width * height" : "Window width * 1.8m typical height"
    }
  ].map((row) => ({ ...row, value: round(row.value) }));

  return {
    rows,
    areaByZone,
    areaByRoomType,
    summary: {
      grossArea: round(grossArea),
      netUsableArea: round(netUsableArea),
      externalWallLength: round(externalWallLength),
      internalWallLength: round(internalWallLength),
      wallArea: round(wallArea),
      doorCount,
      windowCount,
      slabArea: round(slabArea),
      roofArea: round(roofArea),
      curtainWallOrWindowArea: round(curtainWallOrWindowArea)
    }
  };
}

export function checkCompliance(version: PlanVersion): ComplianceItem[] {
  const openings = activeLevel(version)?.openings ?? [];
  const corridorRooms = version.rooms.filter((room) => room.type === "corridor");
  const stairRooms = version.rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  const shaftOrEquipmentRooms = version.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const roomsNeedingDaylight = version.rooms.filter((room) => room.needsDaylight);
  const roomsNeedingPlumbing = version.rooms.filter((room) => room.needsPlumbing);
  const maxEgressDistance = maxDistanceToCore(version);
  const narrowCorridors = corridorRooms.filter((room) => {
    const xs = room.polygon.map(([x]) => x);
    const ys = room.polygon.map(([, y]) => y);
    const width = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return width < 1.2;
  });
  const roomsWithoutDaylight = roomsNeedingDaylight.filter((room) => {
    const windowOpenings = openings.length ? roomOpenings(room, openings, "window") : [];
    return openings.length ? windowOpenings.length === 0 : room.windows.length === 0;
  });
  const plumbingFarRooms = roomsNeedingPlumbing.filter((room) => nearestDistanceToRooms(room, shaftOrEquipmentRooms) > 12);
  const equipmentRooms = version.rooms.filter((room) => room.type === "equipment_room");
  const misalignedEquipmentRooms = equipmentRooms.filter((room) => nearestDistanceToRooms(room, shaftOrEquipmentRooms.filter((target) => target.id !== room.id)) > 10);

  return [
    {
      id: "corridor-width",
      title: "Corridor clear width",
      status: narrowCorridors.length === 0 ? "success" : "warning",
      message:
        narrowCorridors.length === 0
          ? "No corridor room is narrower than 1.2m by bounding-box estimate."
          : `${narrowCorridors.length} corridor room may be narrower than 1.2m.`,
      basis: "Example rule: corridor clear width should not be less than 1.2m."
    },
    {
      id: "egress-distance",
      title: "Egress travel distance",
      status: maxEgressDistance <= 30 ? "success" : "warning",
      message:
        maxEgressDistance <= 30
          ? `Maximum room-to-core distance is about ${round(maxEgressDistance)}m.`
          : `Maximum room-to-core distance is about ${round(maxEgressDistance)}m, above 30m.`,
      basis: "Example rule: egress travel distance should not exceed 30m."
    },
    {
      id: "daylight",
      title: "Main room daylight",
      status: roomsWithoutDaylight.length === 0 ? "success" : "warning",
      message:
        roomsWithoutDaylight.length === 0
          ? "Rooms marked as needing daylight have at least one window."
          : `${roomsWithoutDaylight.length} daylight-required room has no window data.`,
      basis: "Rooms with needsDaylight should have exterior windows."
    },
    {
      id: "plumbing-proximity",
      title: "Plumbing proximity",
      status: plumbingFarRooms.length === 0 ? "success" : "warning",
      message:
        plumbingFarRooms.length === 0
          ? "Rooms needing plumbing are close to shafts or equipment rooms."
          : `${plumbingFarRooms.length} plumbing room may be too far from shafts or equipment rooms.`,
      basis: "Example rule: wet rooms should be near shafts or service zones."
    },
    {
      id: "stair-count",
      title: "Stair and vertical core count",
      status: stairRooms.length >= 1 ? "success" : "warning",
      message:
        stairRooms.length >= 1
          ? `${stairRooms.length} vertical core room is present.`
          : "No stair or elevator core room is present.",
      basis: "Early-stage check: at least one stair/elevator core should exist."
    },
    {
      id: "equipment-shaft-alignment",
      title: "Equipment and shaft alignment",
      status: misalignedEquipmentRooms.length === 0 ? "success" : "warning",
      message:
        misalignedEquipmentRooms.length === 0
          ? "Equipment rooms are aligned with a shaft or service room by distance check."
          : `${misalignedEquipmentRooms.length} equipment room may not align with shafts.`,
      basis: "Example rule: equipment rooms should align with shafts or service risers."
    }
  ];
}
