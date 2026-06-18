import type { ProgramModel, ProgramSpaceRequirement } from "@/lib/building-domain";
import { programFromBrief } from "@/lib/project-domain";
import type { GeneratePlanRequest } from "@/lib/schemas/generate-plan-request-schema";
import type { PlanTopologyVersion } from "@/lib/schemas/plan-version-schema";
import type { DesignBrief, PlanVersion, Room, RoomType } from "@/lib/project-types";

export type ProgramValidationSeverity = "warning" | "error";

export interface ProgramValidationIssue {
  id: string;
  severity: ProgramValidationSeverity;
  message: string;
  spaceId?: string;
  roomIds?: string[];
}

export interface ProgramValidationResult {
  valid: boolean;
  issues: ProgramValidationIssue[];
}

function roomsForSpace(version: PlanVersion, space: ProgramSpaceRequirement) {
  return version.rooms.filter(
    (room) => room.id === space.id || room.type === space.roomType || room.name === space.name
  );
}

function topologyRoomsForSpace(topology: PlanTopologyVersion, space: ProgramSpaceRequirement) {
  return topology.rooms.filter(
    (room) => room.id === space.id || room.type === space.roomType || room.name === space.name
  );
}

function targetRoomsForRule(version: PlanVersion, program: ProgramModel, rule: NonNullable<ProgramSpaceRequirement["adjacencyRules"]>[number]) {
  if (rule.targetSpaceId) {
    const targetSpace = program.spaces.find((space) => space.id === rule.targetSpaceId);
    return targetSpace ? roomsForSpace(version, targetSpace) : version.rooms.filter((room) => room.id === rule.targetSpaceId);
  }

  if (rule.targetRoomType) {
    return version.rooms.filter((room) => room.type === rule.targetRoomType);
  }

  return [];
}

function topologyTargetsForRule(
  topology: PlanTopologyVersion,
  program: ProgramModel,
  rule: NonNullable<ProgramSpaceRequirement["adjacencyRules"]>[number]
) {
  if (rule.targetSpaceId) {
    const targetSpace = program.spaces.find((space) => space.id === rule.targetSpaceId);
    return targetSpace
      ? topologyRoomsForSpace(topology, targetSpace)
      : topology.rooms.filter((room) => room.id === rule.targetSpaceId);
  }

  if (rule.targetRoomType) {
    return topology.rooms.filter((room) => room.type === rule.targetRoomType);
  }

  return [];
}

function areAdjacent(sourceId: string, targetIds: Set<string>, rooms: Room[]) {
  const source = rooms.find((room) => room.id === sourceId);

  if (!source) {
    return false;
  }

  if (source.adjacents?.some((adjacentId) => targetIds.has(adjacentId))) {
    return true;
  }

  const targets = rooms.filter((room) => targetIds.has(room.id));
  const sourceCenter = centroid(source.polygon);
  return targets.some((target) => distance(sourceCenter, centroid(target.polygon)) <= 8);
}

function areTopologyAdjacent(
  topology: PlanTopologyVersion,
  sourceId: string,
  targetIds: Set<string>
) {
  const edgeHit = topology.edges.some(
    (edge) =>
      (edge.from === sourceId && targetIds.has(edge.to)) || (edge.to === sourceId && targetIds.has(edge.from))
  );

  if (edgeHit) {
    return true;
  }

  return topology.rooms.some((room) => {
    if (room.id !== sourceId) {
      return false;
    }

    return (room.adjacencyIds ?? []).some((adjacentId) => targetIds.has(adjacentId));
  });
}

function centroid(points: Room["polygon"]) {
  const total = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as [number, number], [0, 0]);
  return [total[0] / points.length, total[1] / points.length] as [number, number];
}

function distance(a: [number, number], b: [number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function validateRequiredSpaces(
  spaces: ProgramSpaceRequirement[],
  matcher: (space: ProgramSpaceRequirement) => { id: string; type: RoomType }[]
) {
  const issues: ProgramValidationIssue[] = [];

  spaces
    .filter((space) => space.priority === "required")
    .forEach((space) => {
      const matches = matcher(space);
      const requiredCount = space.count ?? 1;

      if (matches.length < requiredCount) {
        issues.push({
          id: "program-required-space-missing",
          severity: "error",
          message: `Required program space "${space.name}" (${space.roomType}) needs at least ${requiredCount}, found ${matches.length}.`,
          spaceId: space.id
        });
      }
    });

  return issues;
}

function validateAreaBounds(
  spaces: ProgramSpaceRequirement[],
  matcher: (space: ProgramSpaceRequirement) => Array<{ id: string; areaSqm: number }>
) {
  const issues: ProgramValidationIssue[] = [];

  spaces.forEach((space) => {
    const matches = matcher(space);

    matches.forEach((room) => {
      if (space.minAreaSqm !== undefined && room.areaSqm < space.minAreaSqm * 0.9) {
        issues.push({
          id: "program-area-below-min",
          severity: space.priority === "required" ? "error" : "warning",
          message: `${space.name} area ${Math.round(room.areaSqm)} sqm is below minimum ${space.minAreaSqm} sqm.`,
          spaceId: space.id,
          roomIds: [room.id]
        });
      }

      if (space.maxAreaSqm !== undefined && room.areaSqm > space.maxAreaSqm * 1.1) {
        issues.push({
          id: "program-area-above-max",
          severity: space.priority === "required" ? "error" : "warning",
          message: `${space.name} area ${Math.round(room.areaSqm)} sqm exceeds maximum ${space.maxAreaSqm} sqm.`,
          spaceId: space.id,
          roomIds: [room.id]
        });
      }
    });
  });

  return issues;
}

function validateAdjacencyRulesForVersion(version: PlanVersion, program: ProgramModel) {
  const issues: ProgramValidationIssue[] = [];

  program.spaces.forEach((space) => {
    space.adjacencyRules?.forEach((rule) => {
      const sourceRooms = roomsForSpace(version, space);
      const targetRooms = targetRoomsForRule(version, program, rule);
      const targetIds = new Set(targetRooms.map((room) => room.id));

      if (!sourceRooms.length || !targetRooms.length) {
        return;
      }

      if (rule.relationship === "must") {
        const satisfied = sourceRooms.some((room) => areAdjacent(room.id, targetIds, version.rooms));

        if (!satisfied) {
          issues.push({
            id: "program-adjacency-must",
            severity: space.priority === "required" ? "error" : "warning",
            message: `"${space.name}" must be adjacent to ${rule.targetRoomType ?? rule.targetSpaceId ?? "target space"}.`,
            spaceId: space.id
          });
        }
      }

      if (rule.relationship === "must_not") {
        const violated = sourceRooms.some((room) => areAdjacent(room.id, targetIds, version.rooms));

        if (violated) {
          issues.push({
            id: "program-adjacency-must-not",
            severity: "error",
            message: `"${space.name}" must not be adjacent to ${rule.targetRoomType ?? rule.targetSpaceId ?? "target space"}.`,
            spaceId: space.id
          });
        }
      }
    });
  });

  return issues;
}

function validateAdjacencyRulesForTopology(topology: PlanTopologyVersion, program: ProgramModel) {
  const issues: ProgramValidationIssue[] = [];

  program.spaces.forEach((space) => {
    space.adjacencyRules?.forEach((rule) => {
      const sourceRooms = topologyRoomsForSpace(topology, space);
      const targetRooms = topologyTargetsForRule(topology, program, rule);
      const targetIds = new Set(targetRooms.map((room) => room.id));

      if (!sourceRooms.length || !targetRooms.length) {
        return;
      }

      if (rule.relationship === "must") {
        const satisfied = sourceRooms.some((room) => areTopologyAdjacent(topology, room.id, targetIds));

        if (!satisfied) {
          issues.push({
            id: "program-topology-adjacency-must",
            severity: space.priority === "required" ? "error" : "warning",
            message: `Topology for "${space.name}" must connect to ${rule.targetRoomType ?? rule.targetSpaceId ?? "target space"}.`,
            spaceId: space.id
          });
        }
      }
    });
  });

  return issues;
}

export function validateTopologyAgainstProgram(
  topology: PlanTopologyVersion,
  program: ProgramModel
): ProgramValidationResult {
  const issues = [
    ...validateRequiredSpaces(program.spaces, (space) => topologyRoomsForSpace(topology, space)),
    ...validateAreaBounds(program.spaces, (space) =>
      topologyRoomsForSpace(topology, space).map((room) => ({
        id: room.id,
        areaSqm: room.targetAreaSqm
      }))
    ),
    ...validateAdjacencyRulesForTopology(topology, program)
  ];

  if (program.targetGrossAreaSqm) {
    const totalTarget = topology.rooms.reduce((sum, room) => sum + room.targetAreaSqm, 0);
    const upperBound = program.targetGrossAreaSqm * (program.floorCount ?? 1) * 1.15;

    if (totalTarget > upperBound) {
      issues.push({
        id: "program-target-gfa-exceeded",
        severity: "warning",
        message: `Topology target area ${Math.round(totalTarget)} sqm exceeds program cap ${Math.round(upperBound)} sqm.`
      });
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}

export function validateVersionAgainstProgram(version: PlanVersion, program: ProgramModel): ProgramValidationResult {
  const issues = [
    ...validateRequiredSpaces(program.spaces, (space) => roomsForSpace(version, space)),
    ...validateAreaBounds(program.spaces, (space) =>
      roomsForSpace(version, space).map((room) => ({
        id: room.id,
        areaSqm: room.areaSqm
      }))
    ),
    ...validateAdjacencyRulesForVersion(version, program)
  ];

  if (program.targetGrossAreaSqm) {
    const grossArea = version.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
    const upperBound = program.targetGrossAreaSqm * (program.floorCount ?? version.levels.length ?? 1) * 1.12;

    if (grossArea > upperBound) {
      issues.push({
        id: "program-gfa-exceeded",
        severity: "warning",
        message: `Gross area ${Math.round(grossArea)} sqm exceeds program target ${Math.round(upperBound)} sqm.`
      });
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}

export function programTopologyErrorSummary(topologies: PlanTopologyVersion[], program: ProgramModel) {
  return topologies.flatMap((topology) =>
    validateTopologyAgainstProgram(topology, program)
      .issues.filter((issue) => issue.severity === "error")
      .map((issue) => ({
        versionId: topology.id,
        issue: issue.id,
        message: issue.message,
        spaceId: issue.spaceId
      }))
  );
}

export function programVersionErrorSummary(versions: PlanVersion[], program: ProgramModel) {
  return versions.flatMap((version) =>
    validateVersionAgainstProgram(version, program)
      .issues.filter((issue) => issue.severity === "error")
      .map((issue) => ({
        versionId: version.id,
        issue: issue.id,
        message: issue.message,
        spaceId: issue.spaceId,
        roomIds: issue.roomIds
      }))
  );
}

export function resolveProgramForGeneration(body: GeneratePlanRequest): ProgramModel {
  if (body.program) {
    return body.program;
  }

  if (body.designBrief) {
    return programFromBrief(body.designBrief);
  }

  return programFromBrief({
    projectType: body.projectType ?? "healthcare",
    description: body.brief ?? "",
    floors: body.floors ?? 1,
    targetArea: 2400,
    corePreference: "",
    orientationPreference: ""
  });
}
