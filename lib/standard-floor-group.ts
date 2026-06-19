import type { Level, Point, Room, StandardFloorGroup } from "@/lib/project-types";

export interface CreateStandardFloorGroupInput {
  id: string;
  label?: string;
  rooms: Room[];
  outline: Point[];
  memberFloorIds?: string[];
}

export function createStandardFloorGroup(input: CreateStandardFloorGroupInput): StandardFloorGroup {
  return {
    id: input.id,
    label: input.label,
    rooms: input.rooms,
    outline: input.outline,
    memberFloorIds: [...(input.memberFloorIds ?? [])]
  };
}

export function editStandardFloorGroup(
  groups: StandardFloorGroup[],
  groupId: string,
  patch: Partial<Pick<StandardFloorGroup, "rooms" | "outline" | "label" | "memberFloorIds">>
): StandardFloorGroup[] {
  return groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group));
}

export function addLevelToStandardFloorGroup(
  groups: StandardFloorGroup[],
  groupId: string,
  levelId: string
): StandardFloorGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) {
      return group;
    }

    if (group.memberFloorIds.includes(levelId)) {
      return group;
    }

    return {
      ...group,
      memberFloorIds: [...group.memberFloorIds, levelId]
    };
  });
}

export function removeLevelFromStandardFloorGroups(
  groups: StandardFloorGroup[],
  levelId: string
): StandardFloorGroup[] {
  return groups
    .map((group) => ({
      ...group,
      memberFloorIds: group.memberFloorIds.filter((id) => id !== levelId)
    }))
    .filter((group) => group.memberFloorIds.length > 0);
}

export function detachLevelFromGroup(level: Level, groups: StandardFloorGroup[]): Level {
  if (!level.standardFloorGroupId) {
    return level;
  }

  const group = groups.find((item) => item.id === level.standardFloorGroupId);

  return {
    ...level,
    standardFloorGroupId: undefined,
    localOverrideRooms: structuredClone(group?.rooms ?? level.rooms),
    rooms: structuredClone(group?.rooms ?? level.rooms)
  };
}

export function findStandardFloorGroup(
  groups: StandardFloorGroup[] | undefined,
  groupId: string | undefined
) {
  if (!groupId || !groups?.length) {
    return undefined;
  }

  return groups.find((group) => group.id === groupId);
}

export function isLevelLinkedToStandardGroup(level: Level) {
  return Boolean(level.standardFloorGroupId && !level.localOverrideRooms);
}

export function standardFloorGroupLabel(group: StandardFloorGroup, levels: Level[]) {
  const members = group.memberFloorIds
    .map((id) => levels.find((level) => level.id === id))
    .filter((level): level is Level => Boolean(level))
    .sort((a, b) => (a.floorNumber ?? 0) - (b.floorNumber ?? 0));

  if (members.length === 0) {
    return group.label ?? "Standard floor group";
  }

  const first = members[0]!.name;
  const last = members[members.length - 1]!.name;

  if (members.length === 1) {
    return first;
  }

  return `${first}–${last} (${members.length} floors)`;
}
