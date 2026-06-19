import { resolveAllVersionRooms } from "@/lib/level-rooms";
import type { PlanVersion, Room } from "@/lib/project-types";

function roomMap(version: PlanVersion) {
  return new Map(resolveAllVersionRooms(version).map((room) => [room.id, room]));
}

export function mergeHybridRooms(
  versionA: PlanVersion,
  versionB: PlanVersion,
  aiVersion: PlanVersion,
  keptFromA: string[],
  keptFromB: string[],
  priority: "A" | "B"
): Room[] {
  const keptA = new Set(keptFromA);
  const keptB = new Set(keptFromB);
  const roomByIdA = roomMap(versionA);
  const roomByIdB = roomMap(versionB);
  const lockedIds = new Set([...keptFromA, ...keptFromB]);
  const result = new Map<string, Room>();

  lockedIds.forEach((id) => {
    const inA = keptA.has(id);
    const inB = keptB.has(id);

    if (inA && inB) {
      const room = priority === "B" ? roomByIdB.get(id) : roomByIdA.get(id);
      if (room) {
        result.set(id, room);
      }
      return;
    }

    if (inA) {
      const room = roomByIdA.get(id);
      if (room) {
        result.set(id, room);
      }
      return;
    }

    const room = roomByIdB.get(id);
    if (room) {
      result.set(id, room);
    }
  });

  aiVersion.rooms.forEach((room) => {
    if (!lockedIds.has(room.id)) {
      result.set(room.id, room);
    }
  });

  return [...result.values()];
}
