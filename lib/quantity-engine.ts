import type { CodeContext } from "@/lib/building-domain";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import type { FunctionZone, OpeningElement, PlanVersion, Point, Room, RoomType, Wall } from "@/lib/project-types";
import { computeEgressPathMetrics, computeWetCorePathMetrics } from "@/lib/rules/path-metrics";
import { resolveRulePack, ruleBasis, ruleThreshold } from "@/lib/rules/rule-pack";
import type { RulePack } from "@/lib/rules/types";

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

export type QuantityScope = "level" | "building";

export interface QuantityOptions {
  levelId?: string;
  scope?: QuantityScope;
}

export interface ComplianceItem {
  id: string;
  title: string;
  status: "success" | "warning";
  message: string;
  basis: string;
  levelId?: string;
  levelName?: string;
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

function nearestDistanceToRooms(room: Room, targets: Room[], version: PlanVersion) {
  if (targets.length === 0) {
    return Infinity;
  }

  const wetMetrics = computeWetCorePathMetrics(version);
  const roomMetric = wetMetrics.perRoom.find((item) => item.roomId === room.id);
  if (roomMetric) {
    return roomMetric.distance;
  }

  const roomCenter = centroid(room);
  return Math.min(...targets.map((target) => distance(roomCenter, centroid(target))));
}

function activeLevel(version: PlanVersion, levelId?: string) {
  if (!levelId) {
    return version.levels[0];
  }

  return version.levels.find((level) => level.id === levelId) ?? version.levels[0];
}

function resolveQuantityScope(version: PlanVersion, levelId?: string, scope?: QuantityScope): QuantityScope {
  if (scope) {
    return scope;
  }

  if (levelId) {
    return "level";
  }

  return version.levels.length > 1 ? "building" : "level";
}

function roomsForQuantities(version: PlanVersion, levelId: string | undefined, scope: QuantityScope) {
  if (scope === "building") {
    return version.rooms;
  }

  const level = activeLevel(version, levelId);
  return level?.rooms ?? version.rooms;
}

function wallsForQuantities(version: PlanVersion, levelId: string | undefined, scope: QuantityScope) {
  if (scope === "building") {
    return version.levels.flatMap((level) => level.walls);
  }

  return activeLevel(version, levelId)?.walls ?? [];
}

function openingsForQuantities(version: PlanVersion, levelId: string | undefined, scope: QuantityScope) {
  if (scope === "building") {
    return version.levels.flatMap((level) => level.openings);
  }

  return activeLevel(version, levelId)?.openings ?? [];
}

function roomOpenings(room: Room, openings: OpeningElement[], type: OpeningElement["type"]) {
  return openings.filter((opening) => opening.type === type && opening.roomIds?.includes(room.id));
}

function buildQuantityResult(
  rooms: Room[],
  walls: Wall[],
  openings: OpeningElement[],
  outline: Point[],
  slabAreaBasis: string,
  roofAreaBasis: string,
  slabAreaOverride?: number,
  roofAreaOverride?: number
): QuantityResult {
  const grossArea = rooms.reduce((total, room) => total + room.areaSqm, 0);
  const netUsableArea = rooms
    .filter((room) => room.zone !== "circulation" && room.type !== "shaft")
    .reduce((total, room) => total + room.areaSqm, 0);
  const outlineArea = polygonArea(outline);
  const externalWallLength = walls.length
    ? walls
        .filter((wall) => wall.type === "external")
        .reduce((total, wall) => total + wallLength(wall), 0)
    : polygonPerimeter(outline);
  const roomPerimeterTotal = rooms.reduce((total, room) => total + polygonPerimeter(room.polygon), 0);
  const internalWallLength = walls.length
    ? walls
        .filter((wall) => wall.type === "internal" || wall.type === "partition" || wall.type === "core")
        .reduce((total, wall) => total + wallLength(wall), 0)
    : Math.max(0, (roomPerimeterTotal - externalWallLength) / 2);
  const averageWallHeight =
    rooms.reduce((total, room) => total + room.ceilingHeight, 0) / Math.max(1, rooms.length);
  const wallArea = walls.length
    ? walls.reduce((total, wall) => total + wallLength(wall) * wall.height, 0)
    : (externalWallLength + internalWallLength) * averageWallHeight;
  const doorCount = openings.length
    ? openings.filter((opening) => opening.type === "door").length
    : rooms.reduce((total, room) => total + room.doors.length, 0);
  const windowCount = openings.length
    ? openings.filter((opening) => opening.type === "window").length
    : rooms.reduce((total, room) => total + room.windows.length, 0);
  const slabArea = slabAreaOverride ?? (outlineArea || grossArea);
  const roofArea = roofAreaOverride ?? slabArea;
  const curtainWallOrWindowArea = openings.length
    ? openings
        .filter((opening) => opening.type === "window")
        .reduce((total, opening) => total + opening.width * opening.height, 0)
    : rooms.reduce(
        (total, room) => total + room.windows.reduce((windowTotal, opening) => windowTotal + opening.width * 1.8, 0),
        0
      );

  const areaByZone = rooms.reduce(
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

  const areaByRoomType = rooms.reduce<Partial<Record<RoomType, number>>>((acc, room) => {
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
      basis: walls.length
        ? "Sum of Level.walls where type = internal, partition or core"
        : "(Sum room perimeters - outline perimeter) / 2"
    },
    {
      id: "wall-area",
      label: walls.length ? "Wall area" : "Wall area estimate",
      value: wallArea,
      unit: "sqm",
      basis: walls.length ? "Sum of wall length * wall height" : "(External + internal wall length) * average ceiling height"
    },
    {
      id: "doors",
      label: "Door count",
      value: doorCount,
      unit: "pcs",
      basis: openings.length ? "Level.openings where type = door" : "Sum of room.doors"
    },
    {
      id: "windows",
      label: "Window count",
      value: windowCount,
      unit: "pcs",
      basis: openings.length ? "Level.openings where type = window" : "Sum of room.windows"
    },
    { id: "slab-area", label: "Floor slab area", value: slabArea, unit: "sqm", basis: slabAreaBasis },
    { id: "roof-area", label: "Roof area", value: roofArea, unit: "sqm", basis: roofAreaBasis },
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

export function calculateQuantities(
  version: PlanVersion,
  levelIdOrOptions?: string | QuantityOptions
): QuantityResult {
  const options: QuantityOptions =
    typeof levelIdOrOptions === "string" ? { levelId: levelIdOrOptions } : (levelIdOrOptions ?? {});
  const scope = resolveQuantityScope(version, options.levelId, options.scope);
  const rooms = roomsForQuantities(version, options.levelId, scope);
  const walls = wallsForQuantities(version, options.levelId, scope);
  const openings = openingsForQuantities(version, options.levelId, scope);
  const outlineArea = polygonArea(version.outline);
  const topLevel = version.levels[version.levels.length - 1];

  if (scope === "building") {
    const perLevelSlab = version.levels.reduce((total, level) => {
      const levelOutline = level.floor?.outline ?? version.outline;
      const levelGross = level.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
      return total + (polygonArea(levelOutline) || levelGross);
    }, 0);
    const roofOutline = topLevel?.floor?.outline ?? version.outline;
    const roofGross = topLevel?.rooms.reduce((sum, room) => sum + room.areaSqm, 0) ?? 0;

    return buildQuantityResult(
      rooms,
      walls,
      openings,
      version.outline,
      "Sum of per-level slab areas",
      "Top level outline area",
      perLevelSlab || outlineArea * Math.max(1, version.levels.length),
      polygonArea(roofOutline) || roofGross || outlineArea
    );
  }

  return buildQuantityResult(
    rooms,
    walls,
    openings,
    version.outline,
    "Outline polygon area",
    "Assume roof equals outline area"
  );
}

export function calculateQuantitiesByLevel(version: PlanVersion): Record<string, QuantityResult> {
  return version.levels.reduce<Record<string, QuantityResult>>((acc, level) => {
    acc[level.id] = calculateQuantities(version, { levelId: level.id, scope: "level" });
    return acc;
  }, {});
}

function checkComplianceForLevel(version: PlanVersion, levelId: string, rulePack: RulePack): ComplianceItem[] {
  const level = activeLevel(version, levelId);
  const rooms = level?.rooms ?? [];
  const openings = level?.openings ?? [];
  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const stairRooms = rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  const shaftOrEquipmentRooms = rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const roomsNeedingDaylight = rooms.filter((room) => room.needsDaylight);
  const roomsNeedingPlumbing = rooms.filter((room) => room.needsPlumbing);
  const egressMetrics = computeEgressPathMetrics(version, levelId);
  const maxEgressDistance = egressMetrics.maxDistance;
  const corridorMinWidth = ruleThreshold(rulePack, "corridor-width", 1.2);
  const egressMaxDistance = rulePack.scoring.egressMaxDistanceM;
  const plumbingMaxDistance = rulePack.scoring.plumbingMaxDistanceM;
  const minCoreCount = ruleThreshold(rulePack, "stair-count", 1);
  const narrowCorridors = corridorRooms.filter((room) => {
    const xs = room.polygon.map(([x]) => x);
    const ys = room.polygon.map(([, y]) => y);
    const width = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return width < corridorMinWidth;
  });
  const roomsWithoutDaylight = roomsNeedingDaylight.filter((room) => {
    const windowOpenings = openings.length ? roomOpenings(room, openings, "window") : [];
    return openings.length ? windowOpenings.length === 0 : room.windows.length === 0;
  });
  const plumbingFarRooms = roomsNeedingPlumbing.filter(
    (room) => nearestDistanceToRooms(room, shaftOrEquipmentRooms, version) > plumbingMaxDistance
  );
  const equipmentRooms = rooms.filter((room) => room.type === "equipment_room");
  const misalignedEquipmentRooms = equipmentRooms.filter((room) =>
    nearestDistanceToRooms(
      room,
      shaftOrEquipmentRooms.filter((target) => target.id !== room.id),
      version
    ) > 10
  );
  const levelName = level?.name ?? levelId;

  return [
    {
      id: "corridor-width",
      title: "Corridor clear width",
      status: narrowCorridors.length === 0 ? "success" : "warning",
      message:
        narrowCorridors.length === 0
          ? `No corridor room is narrower than ${corridorMinWidth}m by bounding-box estimate.`
          : `${narrowCorridors.length} corridor room may be narrower than ${corridorMinWidth}m.`,
      basis: ruleBasis(rulePack, "corridor-width", "Corridor clear width should not be less than 1.2m."),
      levelId,
      levelName
    },
    {
      id: "egress-distance",
      title: "Egress travel distance",
      status: maxEgressDistance <= egressMaxDistance ? "success" : "warning",
      message:
        maxEgressDistance <= egressMaxDistance
          ? `Maximum egress path is about ${round(maxEgressDistance)}m via ${egressMetrics.method}.`
          : `Maximum egress path is about ${round(maxEgressDistance)}m via ${egressMetrics.method}${
              egressMetrics.worstRoomName ? ` (${egressMetrics.worstRoomName})` : ""
            }, above ${egressMaxDistance}m.`,
      basis: ruleBasis(rulePack, "egress-distance", "Egress travel distance should not exceed 30m."),
      levelId,
      levelName
    },
    {
      id: "daylight",
      title: "Main room daylight",
      status: roomsWithoutDaylight.length === 0 ? "success" : "warning",
      message:
        roomsWithoutDaylight.length === 0
          ? "Rooms marked as needing daylight have at least one window."
          : `${roomsWithoutDaylight.length} daylight-required room has no window data.`,
      basis: "Rooms with needsDaylight should have exterior windows.",
      levelId,
      levelName
    },
    {
      id: "plumbing-proximity",
      title: "Plumbing proximity",
      status: plumbingFarRooms.length === 0 ? "success" : "warning",
      message:
        plumbingFarRooms.length === 0
          ? "Rooms needing plumbing are within path distance of shafts or equipment rooms."
          : `${plumbingFarRooms.length} plumbing room may exceed ${plumbingMaxDistance}m path distance to shafts.`,
      basis: `Wet rooms should be within ${plumbingMaxDistance}m path distance of shafts or service zones.`,
      levelId,
      levelName
    },
    {
      id: "stair-count",
      title: "Stair and vertical core count",
      status: stairRooms.length >= minCoreCount ? "success" : "warning",
      message:
        stairRooms.length >= minCoreCount
          ? `${stairRooms.length} vertical core room is present.`
          : "No stair or elevator core room is present.",
      basis: ruleBasis(rulePack, "stair-count", "At least one stair/elevator core should exist."),
      levelId,
      levelName
    },
    {
      id: "equipment-shaft-alignment",
      title: "Equipment and shaft alignment",
      status: misalignedEquipmentRooms.length === 0 ? "success" : "warning",
      message:
        misalignedEquipmentRooms.length === 0
          ? "Equipment rooms are aligned with a shaft or service room by distance check."
          : `${misalignedEquipmentRooms.length} equipment room may not align with shafts.`,
      basis: "Example rule: equipment rooms should align with shafts or service risers.",
      levelId,
      levelName
    }
  ];
}

export function checkCompliance(
  version: PlanVersion,
  codeContext: CodeContext = defaultHealthcareCodeContext,
  rulePack: RulePack = resolveRulePack({ codeContext })
): ComplianceItem[] {
  if (version.levels.length <= 1) {
    const levelId = version.levels[0]?.id ?? "level-01";
    return checkComplianceForLevel(version, levelId, rulePack);
  }

  const perLevel = version.levels.flatMap((level) => checkComplianceForLevel(version, level.id, rulePack));
  const rollup = new Map<string, ComplianceItem>();

  perLevel.forEach((item) => {
    const existing = rollup.get(item.id);

    if (!existing || (existing.status === "success" && item.status === "warning")) {
      rollup.set(item.id, {
        ...item,
        message:
          item.status === "warning"
            ? `${item.message} Worst case on ${item.levelName}.`
            : item.message,
        levelId: undefined,
        levelName: undefined
      });
    }
  });

  return [...rollup.values()];
}
