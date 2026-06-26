import type { TypologyPackId } from "@/lib/typology/types";

export type RemixFunctionalType = "office" | "medical" | "commercial" | "residential" | "exhibition";

export type RemixCorridorStrategy = "central" | "side" | "ring" | "open";

export type RemixLayoutPriority = "daylight" | "area-efficiency" | "circulation";

export interface RetainedStructureRemixParameters {
  targetFunctionalType: RemixFunctionalType;
  targetRoomCount: number;
  publicAreaRatio: number;
  corridorStrategy: RemixCorridorStrategy;
  layoutPriority: RemixLayoutPriority;
  allowSplitLargeRooms: boolean;
  lockExteriorWindows: boolean;
  preserveColumns: boolean;
  preserveCores: boolean;
}

export const REMIX_FUNCTIONAL_TYPE_LABELS: Record<RemixFunctionalType, string> = {
  office: "办公",
  medical: "医疗",
  commercial: "商业",
  residential: "住宅",
  exhibition: "展陈"
};

export const REMIX_CORRIDOR_STRATEGY_LABELS: Record<RemixCorridorStrategy, string> = {
  central: "中廊",
  side: "边廊",
  ring: "环廊",
  open: "开放式"
};

export const REMIX_LAYOUT_PRIORITY_LABELS: Record<RemixLayoutPriority, string> = {
  daylight: "采光优先",
  "area-efficiency": "面积效率优先",
  circulation: "流线优先"
};

export function functionalTypeToTypologyPackId(type: RemixFunctionalType): TypologyPackId {
  switch (type) {
    case "medical":
      return "healthcare";
    case "residential":
      return "residential";
    case "office":
    case "commercial":
    case "exhibition":
    default:
      return "office";
  }
}

export function defaultRemixParameters(input?: {
  relayoutableRoomCount?: number;
  sourceFunctionalType?: RemixFunctionalType;
}): RetainedStructureRemixParameters {
  const relayoutableRoomCount = Math.max(3, input?.relayoutableRoomCount ?? 6);

  return {
    targetFunctionalType: input?.sourceFunctionalType ?? "office",
    targetRoomCount: relayoutableRoomCount,
    publicAreaRatio: 0.25,
    corridorStrategy: "central",
    layoutPriority: "daylight",
    allowSplitLargeRooms: true,
    lockExteriorWindows: false,
    preserveColumns: true,
    preserveCores: true
  };
}

export function remixParametersFromRecord(
  record?: Record<string, string | number | boolean>,
  defaults?: RetainedStructureRemixParameters
): RetainedStructureRemixParameters {
  const base = defaults ?? defaultRemixParameters();

  return {
    targetFunctionalType: isFunctionalType(record?.targetFunctionalType)
      ? record.targetFunctionalType
      : base.targetFunctionalType,
    targetRoomCount:
      typeof record?.targetRoomCount === "number" && record.targetRoomCount >= 2
        ? Math.round(record.targetRoomCount)
        : base.targetRoomCount,
    publicAreaRatio:
      typeof record?.publicAreaRatio === "number"
        ? clamp(record.publicAreaRatio, 0.08, 0.45)
        : base.publicAreaRatio,
    corridorStrategy: isCorridorStrategy(record?.corridorStrategy)
      ? record.corridorStrategy
      : base.corridorStrategy,
    layoutPriority: isLayoutPriority(record?.layoutPriority) ? record.layoutPriority : base.layoutPriority,
    allowSplitLargeRooms: record?.allowSplitLargeRooms !== false,
    lockExteriorWindows: record?.lockExteriorWindows === true,
    preserveColumns: record?.preserveColumns !== false,
    preserveCores: record?.preserveCores !== false
  };
}

export function remixParametersToRecord(
  parameters: RetainedStructureRemixParameters
): Record<string, string | number | boolean> {
  return { ...parameters };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isFunctionalType(value: unknown): value is RemixFunctionalType {
  return (
    value === "office" ||
    value === "medical" ||
    value === "commercial" ||
    value === "residential" ||
    value === "exhibition"
  );
}

function isCorridorStrategy(value: unknown): value is RemixCorridorStrategy {
  return value === "central" || value === "side" || value === "ring" || value === "open";
}

function isLayoutPriority(value: unknown): value is RemixLayoutPriority {
  return value === "daylight" || value === "area-efficiency" || value === "circulation";
}
