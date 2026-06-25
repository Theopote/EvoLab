import { pointInPolygon } from "@/lib/geometry-kernel";
import { resolveLevelRooms } from "@/lib/level-rooms";
import { isPolygonInside } from "@/lib/polygon-ops";
import type {
  Level,
  PlanVersion,
  Point,
  Room,
  StandardFloorGroup,
  TransferFloorHint,
  VerticalAlignmentIssue,
  VerticalElement,
  VerticalElementKind
} from "@/lib/project-types";
import { deriveVerticalElements } from "@/lib/vertical-elements";

const CORE_ROOM_TYPES = new Set<Room["type"]>(["stair", "elevator", "shaft"]);
const COLUMN_CONTAINER_TYPES = new Set<Room["type"]>([
  "corridor",
  "stair",
  "elevator",
  "shaft",
  "equipment_room",
  "lobby"
]);

function isPointElement(position: Point | Point[]): position is Point {
  return typeof position[0] === "number";
}

function levelSortKey(level: Level) {
  return level.floorNumber ?? 0;
}

function isLevelInRange(level: Level, element: VerticalElement, levels: Level[]) {
  const sorted = [...levels].sort((left, right) => levelSortKey(left) - levelSortKey(right));
  const fromIndex = sorted.findIndex((item) => item.id === element.appliesFromFloorId);
  const toIndex = sorted.findIndex((item) => item.id === element.appliesToFloorId);
  const levelIndex = sorted.findIndex((item) => item.id === level.id);

  if (fromIndex < 0 || toIndex < 0 || levelIndex < 0) {
    return true;
  }

  return levelIndex >= fromIndex && levelIndex <= toIndex;
}

function roomsAllowingPointElement(kind: VerticalElementKind, rooms: Room[]) {
  if (kind === "column") {
    return rooms.filter((room) => COLUMN_CONTAINER_TYPES.has(room.type));
  }

  if (kind === "mep_shaft") {
    return rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room" || room.type === "corridor");
  }

  return rooms;
}

function roomsAllowingPolygonElement(kind: VerticalElementKind, rooms: Room[]) {
  if (kind === "core") {
    return rooms.filter((room) => CORE_ROOM_TYPES.has(room.type));
  }

  if (kind === "shear_wall") {
    return rooms.filter((room) => room.type === "corridor" || room.type === "equipment_room");
  }

  return rooms;
}

function pointIsContained(point: Point, rooms: Room[]) {
  return rooms.some((room) => pointInPolygon(point, room.polygon));
}

function polygonIsContained(polygon: Point[], rooms: Room[]) {
  return rooms.some((room) => isPolygonInside(polygon, room.polygon, 0.05));
}

function elementLabel(element: VerticalElement) {
  return element.label ?? element.kind;
}

function issueMessage(level: Level, element: VerticalElement) {
  const label = elementLabel(element);

  if (element.kind === "column") {
    return `${label} has no structural container room on ${level.name}.`;
  }

  if (element.kind === "core") {
    return `${label} core footprint is not contained in a stair/elevator/shaft room on ${level.name}.`;
  }

  if (element.kind === "mep_shaft") {
    return `${label} shaft position is not inside a shaft or service room on ${level.name}.`;
  }

  return `${label} is not aligned with a valid container room on ${level.name}.`;
}

export function checkVerticalAlignment(
  version: PlanVersion,
  elements: VerticalElement[] = version.verticalElements ?? deriveVerticalElements(version),
  groups: StandardFloorGroup[] = version.standardFloorGroups ?? []
): VerticalAlignmentIssue[] {
  const issues: VerticalAlignmentIssue[] = [];

  version.levels.forEach((level) => {
    const rooms = resolveLevelRooms(level, groups);

    elements.forEach((element) => {
      if (!isLevelInRange(level, element, version.levels)) {
        return;
      }

      const position = element.position;
      const pointElement = isPointElement(position);
      const allowedRooms = pointElement
        ? roomsAllowingPointElement(element.kind, rooms)
        : roomsAllowingPolygonElement(element.kind, rooms);
      const roomPool = allowedRooms.length ? allowedRooms : rooms;
      const ok = pointElement
        ? pointIsContained(position, roomPool)
        : polygonIsContained(position, roomPool);

      if (ok) {
        return;
      }

      issues.push({
        id: `vertical-${level.id}-${element.id}`,
        floorId: level.id,
        floorName: level.name,
        elementId: element.id,
        elementKind: element.kind,
        type: "no_containing_room",
        message: issueMessage(level, element),
        position: pointElement ? position : undefined
      });
    });
  });

  return issues;
}

export function suggestTransferFloors(
  version: PlanVersion,
  issues: VerticalAlignmentIssue[]
): TransferFloorHint[] {
  const sortedLevels = [...version.levels].sort((left, right) => levelSortKey(left) - levelSortKey(right));
  const hints: TransferFloorHint[] = [];

  for (let index = 0; index < sortedLevels.length - 1; index += 1) {
    const lower = sortedLevels[index]!;
    const upper = sortedLevels[index + 1]!;

    if (upper.isTransferFloor) {
      continue;
    }

    const lowerColumnIssues = issues.filter(
      (issue) => issue.floorId === lower.id && issue.elementKind === "column"
    ).length;
    const upperColumnIssues = issues.filter(
      (issue) => issue.floorId === upper.id && issue.elementKind === "column"
    ).length;

    if (lowerColumnIssues === 0 && upperColumnIssues > 0 && lower.floorProgram !== upper.floorProgram) {
      hints.push({
        id: `transfer-hint-${lower.id}-${upper.id}`,
        afterLevelId: lower.id,
        beforeLevelId: upper.id,
        message: `Column alignment breaks between ${lower.name} and ${upper.name}. Consider marking a transfer floor.`
      });
    }
  }

  return hints;
}

export interface VerticalAlignmentReport {
  issues: VerticalAlignmentIssue[];
  transferHints: TransferFloorHint[];
  aligned: boolean;
}

export function buildVerticalAlignmentReport(version: PlanVersion): VerticalAlignmentReport {
  const elements = version.verticalElements ?? deriveVerticalElements(version);
  const issues = checkVerticalAlignment(version, elements, version.standardFloorGroups);
  const transferHints = suggestTransferFloors(version, issues);

  return {
    issues,
    transferHints,
    aligned: issues.length === 0
  };
}

export function verticalAlignmentIssuesForLevel(report: VerticalAlignmentReport, levelId: string) {
  return report.issues.filter((issue) => issue.floorId === levelId);
}
