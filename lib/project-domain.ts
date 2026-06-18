import {
  defaultDoorWindowFamilies,
  defaultHealthcareCodeContext,
  type ChangeSet,
  type ChangeSource,
  type ChangeStatus,
  type CodeContext,
  type ElementChange,
  type FacadeEnvelope,
  type ProgramModel,
  type ProgramSpaceRequirement,
  type ProjectDomain,
  type ScheduleBundle,
  type ScheduleTable,
  type SiteModel,
  type StoreyGroup,
  type StoreyStack,
  type StructuralColumn,
  type StructuralSystem,
  type VerticalCirculationSystem
} from "@/lib/building-domain";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { calculateQuantities } from "@/lib/quantity-engine";
import { createDefaultScoringConfig, normalizeScoringConfig, resolveProgramGoalsFromDomain, resolveRulePackFromDomain } from "@/lib/rules/scoring-config";
import { computeTotalScore } from "@/lib/rules/version-total-score";
import type { DesignBrief, PlanVersion, Point, ProjectData, Room, TopologyGraph } from "@/lib/project-types";
import type { SiteContext, ZoningConstraints } from "@/lib/site-types";
import { defaultZoningConstraints } from "@/lib/site-types";

export interface ProjectDomainSyncInput {
  projectType: string;
  brief: DesignBrief;
  outline: Point[];
  zoning: ZoningConstraints;
  siteContext?: SiteContext;
  activeVersion?: PlanVersion;
  orientationDeg?: number;
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`;
}

export function createSiteModel(input: {
  outline: Point[];
  zoning?: ZoningConstraints;
  siteContext?: SiteContext;
  orientationDeg?: number;
  name?: string;
}): SiteModel {
  return {
    id: "site-01",
    name: input.name ?? "Project Site",
    outline: input.outline,
    orientationDeg: input.orientationDeg ?? 0,
    zoning: input.zoning ?? defaultZoningConstraints,
    context: input.siteContext
  };
}

export function programFromBrief(brief: DesignBrief, topologyGraph?: TopologyGraph): ProgramModel {
  const spaces: ProgramSpaceRequirement[] = topologyGraph?.rooms.length
    ? topologyGraph.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        roomType: room.type,
        zone: room.zone,
        targetAreaSqm: room.targetAreaSqm,
        minAreaSqm: Math.max(6, room.targetAreaSqm * 0.85),
        maxAreaSqm: room.targetAreaSqm * 1.2,
        priority: room.type === "corridor" || room.type === "stair" || room.type === "elevator" ? "required" : "preferred",
        needsDaylight: room.needsDaylight,
        needsPlumbing: room.needsPlumbing,
        adjacencyRules: (room.adjacencyIds ?? []).map((targetSpaceId) => ({
          spaceId: room.id,
          targetSpaceId,
          relationship: "prefer" as const
        }))
      }))
    : [
        {
          id: "program-lobby",
          name: "Public Lobby",
          roomType: "lobby",
          zone: "public",
          targetAreaSqm: Math.max(80, brief.targetArea * 0.12),
          priority: "required",
          needsDaylight: true
        },
        {
          id: "program-corridor",
          name: "Main Corridor",
          roomType: "corridor",
          zone: "circulation",
          targetAreaSqm: Math.max(40, brief.targetArea * 0.08),
          priority: "required"
        },
        {
          id: "program-clinical",
          name: "Clinical Rooms",
          roomType: "consultation",
          zone: "private",
          targetAreaSqm: Math.max(60, brief.targetArea * 0.2),
          priority: "preferred",
          needsDaylight: true
        }
      ];

  return {
    id: "program-01",
    label: `${brief.projectType} program`,
    projectType: brief.projectType,
    targetGrossAreaSqm: brief.targetArea,
    floorCount: brief.floors,
    spaces,
    notes: brief.description
  };
}

export function buildStoreyStack(version: PlanVersion): StoreyStack {
  const groups: StoreyGroup[] = [];
  const typicalLevels = version.levels.filter((level) => level.floorProgram === "typical");

  if (typicalLevels.length > 1) {
    groups.push({
      id: "group-typical",
      label: "Typical inpatient floors",
      levelIds: typicalLevels.map((level) => level.id),
      typicalLevelId: typicalLevels[0]?.id,
      floorProgram: "typical"
    });
  }

  version.levels.forEach((level) => {
    if (level.floorProgram === "ground") {
      groups.push({
        id: `group-${level.id}`,
        label: "Ground / public",
        levelIds: [level.id],
        typicalLevelId: level.id,
        floorProgram: level.floorProgram
      });
      return;
    }

    if (level.floorProgram === "top") {
      groups.push({
        id: `group-${level.id}`,
        label: "Top floor",
        levelIds: [level.id],
        typicalLevelId: level.id,
        floorProgram: level.floorProgram
      });
    }
  });

  const totalHeightMeters = version.levels.reduce((total, level) => total + level.height, 0);

  return {
    id: "storey-stack-01",
    levelIds: version.levels.map((level) => level.id),
    groups,
    relations: version.levels.slice(1).map((level, index) => ({
      id: `relation-${version.levels[index].id}-${level.id}`,
      fromLevelId: version.levels[index].id,
      toLevelId: level.id,
      relation: "stacked" as const
    })),
    totalHeightMeters
  };
}

export function buildStructuralSystem(version: PlanVersion): StructuralSystem {
  const spacing = version.building.grids[0]?.lines.filter((line) => line.axis === "x").length
    ? version.overallBounds.width / Math.max(1, version.building.grids[0].lines.filter((line) => line.axis === "x").length - 1)
    : 12;
  const columns: StructuralColumn[] = version.levels.flatMap((level) =>
    version.building.grids.flatMap((grid) =>
      grid.lines
        .filter((line) => line.axis === "x")
        .flatMap((xLine) =>
          grid.lines
            .filter((line) => line.axis === "y")
            .map((yLine) => ({
              id: `col-${level.id}-${xLine.id}-${yLine.id}`,
              levelId: level.id,
              position: [xLine.start[0], yLine.start[1]] as Point,
              width: 0.4,
              depth: 0.4
            }))
        )
    )
  );

  return {
    id: "structure-01",
    gridSpacingMeters: spacing,
    maxSpanMeters: spacing * 2,
    columns,
    beams: [],
    shearWalls: []
  };
}

export function buildFacadeEnvelope(version: PlanVersion): FacadeEnvelope {
  return {
    id: "facade-01",
    defaultWindowRatio: 0.35,
    orientationStrategy: version.rooms.some((room) => room.orientation === "south") ? "south_daylight" : "balanced",
    zones: version.levels.map((level) => ({
      id: `facade-${level.id}-south`,
      levelId: level.id,
      edge: "south" as const,
      strategy: level.floorProgram === "ground" ? "curtain_wall" : "punched_window",
      targetWindowRatio: level.floorProgram === "ground" ? 0.45 : 0.3
    }))
  };
}

export function buildVerticalCirculation(version: PlanVersion): VerticalCirculationSystem {
  const coreRooms = version.rooms.filter((room) => ["stair", "elevator"].includes(room.type));
  const stairRooms = coreRooms.filter((room) => room.type === "stair");
  const elevatorRooms = coreRooms.filter((room) => room.type === "elevator");

  const centroid = (room: Room) => {
    const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
    return [total[0] / room.polygon.length, total[1] / room.polygon.length] as Point;
  };

  return {
    id: "vertical-circulation-01",
    stairRuns: stairRooms.map((room) => ({
      id: `stair-run-${room.id}`,
      levelId: room.levelId ?? version.levels[0]?.id ?? "level-01",
      widthMeters: 1.5,
      riserCount: 18,
      hasLanding: true
    })),
    elevatorGroups: elevatorRooms.map((room) => ({
      id: `elevator-group-${room.id}`,
      levelIds: version.building.cores[0]?.levelIds ?? version.levels.map((level) => level.id),
      cabCount: 1,
      includesFireElevator: true,
      position: centroid(room)
    })),
    refugeFloorLevelIds: []
  };
}

function buildRoomSchedule(version: PlanVersion): ScheduleTable {
  return {
    id: `schedule-rooms-${version.id}`,
    kind: "room",
    title: "Room Schedule",
    columns: ["Level", "Name", "Type", "Zone", "Area sqm"],
    versionId: version.id,
    generatedAt: new Date().toISOString(),
    rows: version.levels.flatMap((level) =>
      level.rooms.map((room) => ({
        id: `room-row-${room.id}`,
        values: {
          Level: level.name,
          Name: room.name,
          Type: room.type,
          Zone: room.zone,
          "Area sqm": room.areaSqm
        }
      }))
    )
  };
}

function buildDoorWindowSchedule(version: PlanVersion): ScheduleTable {
  return {
    id: `schedule-openings-${version.id}`,
    kind: "door_window",
    title: "Door & Window Schedule",
    columns: ["Level", "Type", "Width m", "Height m", "Wall"],
    versionId: version.id,
    generatedAt: new Date().toISOString(),
    rows: version.levels.flatMap((level) =>
      level.openings.map((opening) => ({
        id: `opening-row-${opening.id}`,
        values: {
          Level: level.name,
          Type: opening.type,
          "Width m": opening.width,
          "Height m": opening.height,
          Wall: opening.wallId
        }
      }))
    )
  };
}

function buildAreaSchedule(version: PlanVersion): ScheduleTable {
  const quantities = calculateQuantities(version, { scope: "building" });

  return {
    id: `schedule-area-${version.id}`,
    kind: "area",
    title: "Area Schedule",
    columns: ["Metric", "Value", "Unit"],
    versionId: version.id,
    generatedAt: new Date().toISOString(),
    rows: quantities.rows.map((row) => ({
      id: `area-row-${row.id}`,
      values: {
        Metric: row.label,
        Value: row.value,
        Unit: row.unit
      }
    }))
  };
}

export function buildScheduleBundle(version: PlanVersion): ScheduleBundle {
  return {
    versionId: version.id,
    generatedAt: new Date().toISOString(),
    tables: [buildRoomSchedule(version), buildDoorWindowSchedule(version), buildAreaSchedule(version)]
  };
}

export function diffPlanVersions(base: PlanVersion, target: PlanVersion): ElementChange[] {
  const changes: ElementChange[] = [];
  const baseRooms = new Map(base.rooms.map((room) => [room.id, room]));
  const targetRooms = new Map(target.rooms.map((room) => [room.id, room]));

  targetRooms.forEach((room, roomId) => {
    const previous = baseRooms.get(roomId);

    if (!previous) {
      changes.push({
        elementId: roomId,
        category: "room",
        levelId: room.levelId,
        changeType: "add",
        after: { name: room.name, type: room.type, areaSqm: room.areaSqm }
      });
      return;
    }

    const fields: Array<keyof Room> = ["name", "type", "zone", "areaSqm", "ceilingHeight"];

    fields.forEach((field) => {
      if (previous[field] !== room[field]) {
        changes.push({
          elementId: roomId,
          category: "room",
          levelId: room.levelId,
          field,
          changeType: "update",
          before: previous[field],
          after: room[field]
        });
      }
    });
  });

  baseRooms.forEach((room, roomId) => {
    if (!targetRooms.has(roomId)) {
      changes.push({
        elementId: roomId,
        category: "room",
        levelId: room.levelId,
        changeType: "remove",
        before: { name: room.name, type: room.type, areaSqm: room.areaSqm }
      });
    }
  });

  return changes;
}

export function createChangeSet(input: {
  source: ChangeSource;
  summary: string;
  baseVersion: PlanVersion;
  targetVersion: PlanVersion;
  status?: ChangeSet["status"];
  proposalId?: string;
  acceptedOperationIds?: string[];
}): ChangeSet {
  const status = input.status ?? (input.source === "ai" || input.source === "import" ? "draft" : "applied");

  return {
    id: createId("changeset"),
    source: input.source,
    status,
    summary: input.summary,
    baseVersionId: input.baseVersion.id,
    targetVersionId: input.targetVersion.id,
    changes: diffPlanVersions(input.baseVersion, input.targetVersion),
    lockedElementIds: [],
    createdAt: new Date().toISOString(),
    appliedAt: status === "applied" || status === "approved" ? new Date().toISOString() : undefined,
    baseVersionSnapshot: input.baseVersion,
    proposalId: input.proposalId,
    acceptedOperationIds: input.acceptedOperationIds
  };
}

export function createElementChangeSet(input: {
  source: ChangeSource;
  summary: string;
  versionId: string;
  changes: ElementChange[];
  status?: ChangeSet["status"];
}): ChangeSet {
  return {
    id: createId("changeset"),
    source: input.source,
    status: input.status ?? "draft",
    summary: input.summary,
    baseVersionId: input.versionId,
    changes: input.changes,
    lockedElementIds: [],
    createdAt: new Date().toISOString()
  };
}

export function createDefaultProjectDomain(input: ProjectDomainSyncInput): ProjectDomain {
  const topologyGraph = input.activeVersion?.metadata?.topologyGraph;

  return {
    site: createSiteModel({
      outline: input.outline,
      zoning: input.zoning,
      siteContext: input.siteContext,
      orientationDeg: input.orientationDeg
    }),
    program: programFromBrief(input.brief, topologyGraph),
    codeContext: defaultHealthcareCodeContext,
    scoringConfig: createDefaultScoringConfig(input.projectType),
    doorWindowFamilies: defaultDoorWindowFamilies,
    schedules: input.activeVersion ? [buildScheduleBundle(input.activeVersion)] : [],
    changeSets: [],
    copilotProposals: [],
    lockedElementIds: []
  };
}

export function syncProjectDomain(domain: ProjectDomain | undefined, input: ProjectDomainSyncInput): ProjectDomain {
  const base = domain ?? createDefaultProjectDomain(input);
  const activeVersion = input.activeVersion;

  return {
    ...base,
    site: {
      ...base.site,
      outline: input.outline.length >= 3 ? input.outline : base.site.outline,
      zoning: input.zoning,
      context: input.siteContext ?? base.site.context
    },
    program: programFromBrief(input.brief, activeVersion?.metadata?.topologyGraph ?? undefined),
    storeyStack: activeVersion ? buildStoreyStack(activeVersion) : base.storeyStack,
    structuralSystem: activeVersion ? buildStructuralSystem(activeVersion) : base.structuralSystem,
    facadeEnvelope: activeVersion ? buildFacadeEnvelope(activeVersion) : base.facadeEnvelope,
    verticalCirculation: activeVersion ? buildVerticalCirculation(activeVersion) : base.verticalCirculation,
    schedules: activeVersion
      ? [buildScheduleBundle(activeVersion), ...base.schedules.filter((item) => item.versionId !== activeVersion.id)]
      : base.schedules
  };
}

export function appendChangeSet(domain: ProjectDomain, changeSet: ChangeSet, maxEntries = 30): ProjectDomain {
  return {
    ...domain,
    changeSets: [changeSet, ...domain.changeSets].slice(0, maxEntries)
  };
}

export function normalizeProjectDomain(domain?: ProjectDomain, input?: ProjectDomainSyncInput): ProjectDomain {
  if (!domain && !input) {
    throw new Error("normalizeProjectDomain requires either an existing domain or sync input.");
  }

  if (!domain) {
    return createDefaultProjectDomain(input!);
  }

  if (!input) {
    return {
      ...domain,
      codeContext: domain.codeContext ?? defaultHealthcareCodeContext,
      scoringConfig: normalizeScoringConfig(domain.scoringConfig, domain.program.projectType),
      doorWindowFamilies: domain.doorWindowFamilies?.length ? domain.doorWindowFamilies : defaultDoorWindowFamilies,
      schedules: domain.schedules ?? [],
      changeSets: domain.changeSets ?? [],
      copilotProposals: domain.copilotProposals ?? [],
      lockedElementIds: domain.lockedElementIds ?? []
    };
  }

  return syncProjectDomain(domain, input);
}

export function normalizeProjectData(
  project: Omit<ProjectData, "domain"> & { domain?: ProjectDomain },
  syncInput?: Omit<ProjectDomainSyncInput, "activeVersion">
): ProjectData {
  const activeVersion = project.versions.find((version) => version.id === project.activeVersionId) ?? project.versions[0];
  const input: ProjectDomainSyncInput = {
    projectType: project.projectType,
    brief: {
      projectType: project.projectType,
      description: "",
      floors: activeVersion?.metadata?.floorCount ?? activeVersion?.levels.length ?? 1,
      targetArea: activeVersion?.rooms.reduce((total, room) => total + room.areaSqm, 0) ?? 0,
      corePreference: "",
      orientationPreference: ""
    },
    outline: activeVersion?.outline ?? [],
    zoning: defaultZoningConstraints,
    activeVersion,
    ...syncInput
  };

  return {
    ...project,
    domain: normalizeProjectDomain(project.domain, input)
  };
}

export function getCodeContext(domain?: ProjectDomain): CodeContext {
  return domain?.codeContext ?? defaultHealthcareCodeContext;
}

export function getRulePack(domain?: ProjectDomain, projectType?: string) {
  return resolveRulePackFromDomain(domain, projectType);
}

export function getProgramGoals(domain?: ProjectDomain, projectType?: string) {
  return resolveProgramGoalsFromDomain(domain, projectType);
}

export function scorePlanVersion(version: PlanVersion, domain?: ProjectDomain) {
  return computeTotalScore(version.scores ?? {
    areaEfficiency: 0,
    circulationScore: 0,
    daylightScore: 0,
    mepAlignmentScore: 0,
    riskCount: 0
  }, getProgramGoals(domain));
}

export function getActiveSchedule(domain: ProjectDomain | undefined, versionId?: string): ScheduleBundle | undefined {
  if (!domain || !versionId) {
    return domain?.schedules[0];
  }

  return domain.schedules.find((schedule) => schedule.versionId === versionId) ?? domain.schedules[0];
}

export function formatElementChange(change: ElementChange) {
  const action =
    change.changeType === "add" ? "Added" : change.changeType === "remove" ? "Removed" : "Updated";

  if (change.field) {
    return `${action} ${change.category} ${change.elementId} · ${change.field}`;
  }

  return `${action} ${change.category} ${change.elementId}`;
}

export function countChangesByType(changes: ElementChange[]) {
  return changes.reduce(
    (acc, change) => {
      acc[change.changeType] += 1;
      return acc;
    },
    { add: 0, update: 0, remove: 0 }
  );
}

export function pendingChangeSets(domain: ProjectDomain) {
  return domain.changeSets.filter((changeSet) => changeSet.status === "draft");
}

export function approveChangeSetInDomain(
  domain: ProjectDomain,
  changeSetId: string,
  options?: { lockChangedElements?: boolean }
): ProjectDomain {
  const changeSet = domain.changeSets.find((item) => item.id === changeSetId);

  if (!changeSet || changeSet.status !== "draft") {
    return domain;
  }

  const lockedElementIds = options?.lockChangedElements
    ? [...new Set([...domain.lockedElementIds, ...changeSet.changes.map((change) => change.elementId)])]
    : domain.lockedElementIds;

  return {
    ...domain,
    lockedElementIds,
    changeSets: domain.changeSets.map((item) =>
      item.id === changeSetId
        ? {
            ...item,
            status: "approved" as ChangeStatus,
            appliedAt: item.appliedAt ?? new Date().toISOString(),
            reviewedAt: new Date().toISOString()
          }
        : item
    )
  };
}

export function rejectChangeSetInDomain(
  domain: ProjectDomain,
  changeSetId: string,
  versions: PlanVersion[]
): { domain: ProjectDomain; versions: PlanVersion[]; activeVersionId: string } {
  const changeSet = domain.changeSets.find((item) => item.id === changeSetId);

  if (!changeSet || changeSet.status !== "draft") {
    return {
      domain,
      versions,
      activeVersionId: versions[0]?.id ?? ""
    };
  }

  let nextVersions = [...versions];

  if (changeSet.baseVersionSnapshot) {
    const snapshot = normalizePlanVersion(changeSet.baseVersionSnapshot);
    nextVersions = nextVersions.some((version) => version.id === snapshot.id)
      ? nextVersions.map((version) => (version.id === snapshot.id ? snapshot : version))
      : [...nextVersions, snapshot];
  }

  if (changeSet.targetVersionId && changeSet.targetVersionId !== changeSet.baseVersionId) {
    nextVersions = nextVersions.filter((version) => version.id !== changeSet.targetVersionId);
  }

  return {
    domain: {
      ...domain,
      changeSets: domain.changeSets.map((item) =>
        item.id === changeSetId
          ? {
              ...item,
              status: "rejected" as ChangeStatus,
              reviewedAt: new Date().toISOString()
            }
          : item
      )
    },
    versions: nextVersions,
    activeVersionId: changeSet.baseVersionId
  };
}
