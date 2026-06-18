import { computeDaylightSamples } from "@/lib/analysis/daylight";
import type { PlanVersion, Room } from "@/lib/project-types";
import { hasExternalWall, hasWindow } from "@/lib/rules/metrics/room-geometry";

export interface DaylightComplianceResult {
  roomId: string;
  roomName: string;
  hasExteriorWall: boolean;
  hasWindowOpening: boolean;
  penetrationDepthM: number;
  depthOk: boolean;
  compliant: boolean;
}

export function checkRoomDaylightCompliance(
  version: PlanVersion,
  room: Room,
  maxDepthM: number
): DaylightComplianceResult {
  const touchesExterior = hasExternalWall(version, room);
  const hasOpening = hasWindow(version, room);
  const [sample] = computeDaylightSamples(version, [room]);
  const penetrationDepthM = sample?.penetration ?? 0;
  const depthOk = penetrationDepthM <= maxDepthM;
  const compliant = touchesExterior && hasOpening && depthOk;

  return {
    roomId: room.id,
    roomName: room.name,
    hasExteriorWall: touchesExterior,
    hasWindowOpening: hasOpening,
    penetrationDepthM,
    depthOk,
    compliant
  };
}

export function checkDaylightCompliance(
  version: PlanVersion,
  rooms: Room[],
  maxDepthM: number
): DaylightComplianceResult[] {
  return rooms
    .filter((room) => room.needsDaylight)
    .map((room) => checkRoomDaylightCompliance(version, room, maxDepthM));
}
