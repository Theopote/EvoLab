import { summarizeRoomChanges } from "@/lib/plan-change-diff";
import type { FunctionZone, PlanVersion, Room, RoomType } from "@/lib/project-types";
import {
  REMIX_CORRIDOR_STRATEGY_LABELS,
  REMIX_FUNCTIONAL_TYPE_LABELS,
  REMIX_LAYOUT_PRIORITY_LABELS,
  type RetainedStructureRemixParameters
} from "@/lib/retained-structure/remix-parameters";
import { isRetainedStructureRoom } from "@/lib/retained-structure/structure-rooms";

export type RemixRoomChangeKind = "preserved" | "unchanged" | "modified" | "added" | "removed";

export interface RemixRoomDiffEntry {
  id: string;
  name: string;
  type: RoomType;
  zone: FunctionZone;
  kind: RemixRoomChangeKind;
  beforeAreaSqm?: number;
  afterAreaSqm?: number;
  areaDeltaSqm?: number;
  typeChanged?: { from: RoomType; to: RoomType };
  zoneChanged?: { from: FunctionZone; to: FunctionZone };
  nameChanged?: { from: string; to: string };
  geometryChanged?: boolean;
}

export interface RemixZoneSummary {
  zone: FunctionZone;
  label: string;
  beforeSqm: number;
  afterSqm: number;
  deltaSqm: number;
  beforeShare: number;
  afterShare: number;
}

export type RemixRiskLevel = "info" | "warning";

export interface RemixRisk {
  id: string;
  level: RemixRiskLevel;
  message: string;
}

export interface RemixDiffSummary {
  relayoutedCount: number;
  unchangedProgramCount: number;
  preservedStructureCount: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  programAreaBefore: number;
  programAreaAfter: number;
  programAreaDelta: number;
}

export interface RemixDiffReport {
  summary: RemixDiffSummary;
  circulationSummary: string;
  preserved: RemixRoomDiffEntry[];
  unchanged: RemixRoomDiffEntry[];
  changed: RemixRoomDiffEntry[];
  added: RemixRoomDiffEntry[];
  removed: RemixRoomDiffEntry[];
  zoneSummary: RemixZoneSummary[];
  risks: RemixRisk[];
  rationale: string[];
}

const ZONE_LABELS: Record<FunctionZone, string> = {
  public: "公共",
  semi_public: "半公共",
  private: "私密",
  service: "后勤",
  circulation: "交通"
};

const ROOM_TYPE_LABELS: Partial<Record<RoomType, string>> = {
  lobby: "门厅",
  corridor: "走廊",
  consultation: "诊室",
  ward: "病房",
  office: "办公",
  living_room: "起居",
  bedroom: "卧室",
  kitchen: "厨房",
  bathroom: "卫生间",
  stair: "楼梯",
  elevator: "电梯",
  shaft: "井道",
  equipment_room: "设备间",
  other: "其他"
};

function roomLabel(type: RoomType) {
  return ROOM_TYPE_LABELS[type] ?? type;
}

function programRooms(rooms: Room[]) {
  return rooms.filter((room) => !isRetainedStructureRoom(room));
}

function sumArea(rooms: Room[]) {
  return rooms.reduce((total, room) => total + room.areaSqm, 0);
}

function areaByZone(rooms: Room[]): Record<FunctionZone, number> {
  return rooms.reduce(
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
}

function buildRoomEntry(
  room: Room,
  kind: RemixRoomChangeKind,
  before?: Room
): RemixRoomDiffEntry {
  const entry: RemixRoomDiffEntry = {
    id: room.id,
    name: room.name,
    type: room.type,
    zone: room.zone,
    kind
  };

  if (before) {
    entry.beforeAreaSqm = before.areaSqm;
    entry.afterAreaSqm = room.areaSqm;
    entry.areaDeltaSqm = round1(room.areaSqm - before.areaSqm);
    entry.geometryChanged = JSON.stringify(before.polygon) !== JSON.stringify(room.polygon);

    if (before.type !== room.type) {
      entry.typeChanged = { from: before.type, to: room.type };
    }

    if (before.zone !== room.zone) {
      entry.zoneChanged = { from: before.zone, to: room.zone };
    }

    if (before.name !== room.name) {
      entry.nameChanged = { from: before.name, to: room.name };
    }
  } else if (kind === "added") {
    entry.afterAreaSqm = room.areaSqm;
  } else if (kind === "removed") {
    entry.beforeAreaSqm = room.areaSqm;
  }

  return entry;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function buildZoneSummary(before: Room[], after: Room[]): RemixZoneSummary[] {
  const beforeZones = areaByZone(before);
  const afterZones = areaByZone(after);
  const beforeTotal = sumArea(before) || 1;
  const afterTotal = sumArea(after) || 1;

  return (Object.keys(ZONE_LABELS) as FunctionZone[]).map((zone) => ({
    zone,
    label: ZONE_LABELS[zone],
    beforeSqm: round1(beforeZones[zone]),
    afterSqm: round1(afterZones[zone]),
    deltaSqm: round1(afterZones[zone] - beforeZones[zone]),
    beforeShare: round1((beforeZones[zone] / beforeTotal) * 100),
    afterShare: round1((afterZones[zone] / afterTotal) * 100)
  }));
}

function buildRationale(parameters: RetainedStructureRemixParameters, summary: RemixDiffSummary): string[] {
  const lines: string[] = [];

  lines.push(
    `目标功能为${REMIX_FUNCTIONAL_TYPE_LABELS[parameters.targetFunctionalType]}，程序房间按新拓扑重新排布，共 ${parameters.targetRoomCount} 间目标规模。`
  );

  lines.push(
    `采用${REMIX_CORRIDOR_STRATEGY_LABELS[parameters.corridorStrategy]}策略，优化方向为${REMIX_LAYOUT_PRIORITY_LABELS[parameters.layoutPriority]}。`
  );

  lines.push(
    `公共区目标占比 ${Math.round(parameters.publicAreaRatio * 100)}%${
      parameters.allowSplitLargeRooms ? "，允许拆分大房间以匹配目标房间数" : "，不拆分大房间"
    }。`
  );

  if (parameters.preserveColumns) {
    lines.push("柱网位置保持不变，重划仅在可用开间内进行。");
  }

  if (parameters.preserveCores) {
    lines.push("核心筒、竖向井道与设备间几何锁定，不参与重划。");
  }

  if (parameters.lockExteriorWindows) {
    lines.push("外墙窗位已锁定，外立面开窗房间尽量保持原窗位置。");
  }

  if (summary.relayoutedCount > 0) {
    lines.push(`实际重划 ${summary.relayoutedCount} 个非结构房间，${summary.unchangedProgramCount} 个程序房间几何未变。`);
  }

  return lines;
}

function buildRisks(
  before: PlanVersion,
  after: PlanVersion,
  changed: RemixRoomDiffEntry[],
  added: RemixRoomDiffEntry[],
  removed: RemixRoomDiffEntry[],
  zoneSummary: RemixZoneSummary[],
  parameters: RetainedStructureRemixParameters
): RemixRisk[] {
  const risks: RemixRisk[] = [];

  for (const entry of changed) {
    if (!entry.beforeAreaSqm || !entry.areaDeltaSqm) {
      continue;
    }

    const ratio = Math.abs(entry.areaDeltaSqm) / entry.beforeAreaSqm;
    if (ratio >= 0.3) {
      risks.push({
        id: `area-swing-${entry.id}`,
        level: "warning",
        message: `「${entry.name}」面积变化 ${entry.areaDeltaSqm > 0 ? "+" : ""}${entry.areaDeltaSqm} ㎡（${Math.round(ratio * 100)}%），需复核家具布置与净高。`
      });
    }

    if (entry.typeChanged) {
      risks.push({
        id: `type-change-${entry.id}`,
        level: "warning",
        message: `「${entry.name}」功能由 ${roomLabel(entry.typeChanged.from)} 改为 ${roomLabel(entry.typeChanged.to)}，需确认机电与法规适配。`
      });
    }

    if (entry.zoneChanged) {
      risks.push({
        id: `zone-change-${entry.id}`,
        level: "info",
        message: `「${entry.name}」分区由 ${ZONE_LABELS[entry.zoneChanged.from]} 调整为 ${ZONE_LABELS[entry.zoneChanged.to]}。`
      });
    }
  }

  const publicZone = zoneSummary.find((item) => item.zone === "public");
  if (publicZone && publicZone.deltaSqm < -5) {
    risks.push({
      id: "public-shrink",
      level: "warning",
      message: `公共区面积减少 ${Math.abs(publicZone.deltaSqm)} ㎡，可能影响入口体验与疏散缓冲。`
    });
  }

  const circulationZone = zoneSummary.find((item) => item.zone === "circulation");
  if (parameters.corridorStrategy === "open" && circulationZone && circulationZone.afterShare < 8) {
    risks.push({
      id: "open-low-circulation",
      level: "info",
      message: "开放式策略下交通面积占比较低，需确认疏散宽度与消防分区。"
    });
  }

  if (parameters.corridorStrategy !== "open" && circulationZone && circulationZone.afterShare > 22) {
    risks.push({
      id: "high-circulation",
      level: "info",
      message: `交通面积占比 ${circulationZone.afterShare}%，面积效率可能偏低。`
    });
  }

  for (const entry of removed) {
    const beforeRoom = before.rooms.find((room) => room.id === entry.id);
    if (beforeRoom?.needsPlumbing) {
      risks.push({
        id: `plumbing-removed-${entry.id}`,
        level: "warning",
        message: `移除的「${entry.name}」原需给排水，请确认新程序中已覆盖湿区需求。`
      });
    }
  }

  for (const entry of added) {
    const afterRoom = after.rooms.find((room) => room.id === entry.id);
    if (afterRoom?.needsDaylight && parameters.layoutPriority !== "daylight") {
      risks.push({
        id: `daylight-added-${entry.id}`,
        level: "info",
        message: `新增「${entry.name}」需天然采光，建议复核外窗可达性。`
      });
    }
  }

  const programAfter = programRooms(after.rooms);
  const programRoomCount = programAfter.filter(
    (room) => room.type !== "corridor" && room.type !== "lobby"
  ).length;

  if (Math.abs(programRoomCount - parameters.targetRoomCount) > 1) {
    risks.push({
      id: "room-count-gap",
      level: "info",
      message: `实际程序房间 ${programRoomCount} 间，与目标 ${parameters.targetRoomCount} 间存在偏差（含走廊/门厅统计口径差异）。`
    });
  }

  if (removed.length >= 2) {
    risks.push({
      id: "multi-remove",
      level: "info",
      message: `共移除 ${removed.length} 个房间，新增 ${added.length} 个，属于程序重组而非微调。`
    });
  }

  return risks.slice(0, 8);
}

function buildCirculationSummary(
  before: Room[],
  after: Room[],
  zoneSummary: RemixZoneSummary[],
  parameters: RetainedStructureRemixParameters
): string {
  const circulation = zoneSummary.find((zone) => zone.zone === "circulation");
  const beforeCorridors = before.filter((room) => room.type === "corridor").length;
  const afterCorridors = after.filter((room) => room.type === "corridor").length;

  if (!circulation) {
    return `采用${REMIX_CORRIDOR_STRATEGY_LABELS[parameters.corridorStrategy]}，走廊数量 ${beforeCorridors} → ${afterCorridors}。`;
  }

  const shareDelta = circulation.afterShare - circulation.beforeShare;
  const shareText =
    shareDelta === 0
      ? "交通占比不变"
      : shareDelta > 0
        ? `交通占比上升 ${Math.abs(shareDelta).toFixed(1)}%`
        : `交通占比下降 ${Math.abs(shareDelta).toFixed(1)}%`;

  if (parameters.corridorStrategy === "open" && afterCorridors === 0) {
    return `开放式布局，取消独立走廊；${shareText}（${circulation.beforeShare}% → ${circulation.afterShare}%）。`;
  }

  return `${REMIX_CORRIDOR_STRATEGY_LABELS[parameters.corridorStrategy]}，走廊 ${beforeCorridors} → ${afterCorridors} 段；${shareText}（${circulation.beforeShare}% → ${circulation.afterShare}%）。`;
}

export function buildRemixDiffReport(
  before: PlanVersion,
  after: PlanVersion,
  parameters: RetainedStructureRemixParameters
): RemixDiffReport {
  const changes = summarizeRoomChanges(before, after);
  const preservedIds = new Set(after.rooms.filter(isRetainedStructureRoom).map((room) => room.id));

  const preserved = after.rooms
    .filter((room) => preservedIds.has(room.id))
    .map((room) => buildRoomEntry(room, "preserved", before.rooms.find((item) => item.id === room.id)));

  const added = after.rooms
    .filter((room) => changes.added.includes(room.id) && !preservedIds.has(room.id))
    .map((room) => buildRoomEntry(room, "added"));

  const removed = before.rooms
    .filter((room) => changes.removed.includes(room.id) && !preservedIds.has(room.id))
    .map((room) => buildRoomEntry(room, "removed"));

  const changed = after.rooms
    .filter((room) => changes.modified.includes(room.id) && !preservedIds.has(room.id))
    .map((room) => buildRoomEntry(room, "modified", before.rooms.find((item) => item.id === room.id)));

  const unchanged = after.rooms
    .filter((room) => {
      if (preservedIds.has(room.id) || changes.added.includes(room.id) || changes.modified.includes(room.id)) {
        return false;
      }

      return before.rooms.some((item) => item.id === room.id);
    })
    .map((room) => buildRoomEntry(room, "unchanged", before.rooms.find((item) => item.id === room.id)));

  const beforeProgram = programRooms(before.rooms);
  const afterProgram = programRooms(after.rooms);
  const programAreaBefore = sumArea(beforeProgram);
  const programAreaAfter = sumArea(afterProgram);

  const summary: RemixDiffSummary = {
    relayoutedCount: changed.length + added.length + removed.length,
    unchangedProgramCount: unchanged.length,
    preservedStructureCount: preserved.length,
    addedCount: added.length,
    removedCount: removed.length,
    modifiedCount: changed.length,
    programAreaBefore: round1(programAreaBefore),
    programAreaAfter: round1(programAreaAfter),
    programAreaDelta: round1(programAreaAfter - programAreaBefore)
  };

  const zoneSummary = buildZoneSummary(beforeProgram, afterProgram);
  const circulationSummary = buildCirculationSummary(beforeProgram, afterProgram, zoneSummary, parameters);
  const rationale = buildRationale(parameters, summary);
  const risks = buildRisks(before, after, changed, added, removed, zoneSummary, parameters);

  return {
    summary,
    circulationSummary,
    preserved,
    unchanged,
    changed,
    added,
    removed,
    zoneSummary,
    risks,
    rationale
  };
}

export function formatAreaDelta(delta?: number) {
  if (delta === undefined || delta === 0) {
    return "—";
  }

  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} ㎡`;
}

export function previewModeForRoomFocus(
  entry: Pick<RemixRoomDiffEntry, "kind">,
  currentMode: "before" | "after"
): "before" | "after" {
  if (entry.kind === "removed") {
    return "before";
  }

  if (entry.kind === "added") {
    return "after";
  }

  return currentMode;
}

export function isRoomInVersion(version: PlanVersion, roomId: string) {
  return version.rooms.some((room) => room.id === roomId);
}

export function previewFocusHint(
  entry: Pick<RemixRoomDiffEntry, "kind" | "name">,
  previewMode: "before" | "after"
): string | undefined {
  if (entry.kind === "removed" && previewMode === "after") {
    return `「${entry.name}」已移除，请查看重划前视图`;
  }

  if (entry.kind === "added" && previewMode === "before") {
    return `「${entry.name}」为新增房间，请查看重划后视图`;
  }

  return undefined;
}
