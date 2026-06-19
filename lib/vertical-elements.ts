import { resolveLevelRooms } from "@/lib/level-rooms";
import type { PlanVersion, Point, Room, VerticalElement, VerticalElementKind } from "@/lib/project-types";
import { getGridColumnPositions } from "@/lib/viewer-3d/building-model-utils";

const CORE_ROOM_TYPES = new Set<Room["type"]>(["stair", "elevator", "shaft"]);

function roomCentroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function stackKey(point: Point, precision = 0.25) {
  return `${Math.round(point[0] / precision)}:${Math.round(point[1] / precision)}`;
}

function resolveElementKind(room: Room): VerticalElementKind {
  if (room.type === "shaft") {
    return "mep_shaft";
  }

  return "core";
}

export function deriveVerticalElements(version: PlanVersion): VerticalElement[] {
  const levels = version.levels;

  if (!levels.length) {
    return version.verticalElements ?? [];
  }

  const firstLevelId = levels[0]!.id;
  const lastLevelId = levels[levels.length - 1]!.id;
  const elements: VerticalElement[] = [];

  getGridColumnPositions(version).forEach((position, index) => {
    elements.push({
      id: `vertical-column-${index}`,
      kind: "column",
      position,
      appliesFromFloorId: firstLevelId,
      appliesToFloorId: lastLevelId,
      label: `Column ${index + 1}`
    });
  });

  const stacks = new Map<
    string,
    {
      kind: VerticalElementKind;
      position: Point | Point[];
      levelIds: string[];
      label: string;
    }
  >();

  levels.forEach((level) => {
    resolveLevelRooms(level, version.standardFloorGroups)
      .filter((room) => CORE_ROOM_TYPES.has(room.type))
      .forEach((room) => {
        const kind = resolveElementKind(room);
        const key = stackKey(roomCentroid(room));
        const existing = stacks.get(key);
        const position = kind === "core" ? room.polygon : roomCentroid(room);
        const label = room.name || room.type;

        if (existing) {
          if (!existing.levelIds.includes(level.id)) {
            existing.levelIds.push(level.id);
          }
          return;
        }

        stacks.set(key, {
          kind,
          position,
          levelIds: [level.id],
          label
        });
      });
  });

  [...stacks.entries()].forEach(([key, stack]) => {
    const sortedLevelIds = [...stack.levelIds].sort((leftId, rightId) => {
      const left = levels.find((level) => level.id === leftId);
      const right = levels.find((level) => level.id === rightId);
      return (left?.floorNumber ?? 0) - (right?.floorNumber ?? 0);
    });

    elements.push({
      id: `vertical-core-${key}`,
      kind: stack.kind,
      position: stack.position,
      appliesFromFloorId: sortedLevelIds[0] ?? firstLevelId,
      appliesToFloorId: sortedLevelIds[sortedLevelIds.length - 1] ?? lastLevelId,
      label: stack.label
    });
  });

  return elements;
}

export function syncVerticalElements(version: PlanVersion): PlanVersion {
  return {
    ...version,
    verticalElements: deriveVerticalElements(version)
  };
}
