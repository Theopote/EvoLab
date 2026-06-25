import { produce } from "immer";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { applyLevelWallDrag } from "@/lib/geometry/walls/apply-wall-drag";
import { applyWallGeometryPatch } from "@/lib/geometry/walls/apply-wall-geometry";
import { applyLevelWallMerge, applyLevelWallSplit } from "@/lib/geometry/walls/apply-wall-topology";
import { findWallEdgeForWall } from "@/lib/geometry/walls/sync-rooms-from-walls";
import { applyLevelRoomsToVersion, applyRoomPatchToVersion, resolveLevelOutline } from "@/lib/level-rooms";
import { deriveWallGraph, findWallEdge } from "@/lib/wall-graph";
import { applyPlanOperations } from "@/lib/plan-change-engine";
import type { PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import {
  bumpGeometryRevision,
  commitNormalizedVersionDraft,
  commitRoomMetadataDraft,
  commitTopologyVersionDraft,
  getLevel,
  isElementLocked,
  OPENING_GEOMETRY_KEYS,
  patchTouchesGeometry,
  recordGeometryVersionChangeSet,
  refreshDerivedDraft,
  ROOM_GEOMETRY_KEYS,
  WALL_GEOMETRY_KEYS
} from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { GeometrySliceActions, WallDragCommitInput } from "@/lib/store/slice-types";
import type { StateCreator } from "zustand";

export const createGeometrySlice: StateCreator<EvoProjectStore, [], [], GeometrySliceActions> = (set) => ({
  updateRoom: (roomId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, roomId)) {
          return;
        }

        if (patchTouchesGeometry(patch, ROOM_GEOMETRY_KEYS)) {
          const normalized = normalizePlanVersion(state.activeVersion);
          const nextVersion = applyRoomPatchToVersion(normalized, state.activeLevelId, roomId, patch);

          if (!nextVersion) {
            return;
          }

          commitNormalizedVersionDraft(
            state,
            normalizePlanVersion(nextVersion),
            false,
            true,
            `Updated room geometry for ${roomId}`,
            "user"
          );
          return;
        }

        const nextVersion = applyRoomPatchToVersion(state.activeVersion, state.activeLevelId, roomId, patch);

        if (!nextVersion) {
          return;
        }

        commitRoomMetadataDraft(state, nextVersion);
      })
    ),
  updateRoomGeometry: (roomId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, roomId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const nextVersion = applyRoomPatchToVersion(normalized, state.activeLevelId, roomId, patch);

        if (!nextVersion) {
          return;
        }

        commitNormalizedVersionDraft(
          state,
          normalizePlanVersion(nextVersion),
          false,
          true,
          `Updated room geometry for ${roomId}`,
          "user"
        );
      })
    ),
  applyLevelRoomsGeometry: (rooms) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (rooms.some((room) => isElementLocked(state, room.id))) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const nextVersion = applyLevelRoomsToVersion(normalized, state.activeLevelId, rooms);

        if (!nextVersion) {
          return;
        }

        const previousVersion = normalized;
        const committedVersion = normalizePlanVersion(nextVersion);

        state.project.versions = state.project.versions.map((item) =>
          item.id === committedVersion.id ? committedVersion : item
        );
        state.project.activeVersionId = committedVersion.id;

        if (previousVersion) {
          recordGeometryVersionChangeSet(state, previousVersion, committedVersion);
        }

        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  applyWallDragCommit: (input: WallDragCommitInput) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion || input.offset === 0) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = getLevel(normalized, state.activeLevelId);

        if (!level) {
          return;
        }

        const wall = level.walls.find((candidate) => candidate.id === input.wallId);
        const edge = wall ? findWallEdgeForWall(wall, level.rooms) : undefined;
        const graphEdge = findWallEdge(deriveWallGraph(level.rooms).edges, input.wallId);
        const affectedRoomIds = wall?.roomIds.length
          ? wall.roomIds
          : edge?.roomIds ?? graphEdge?.roomIds ?? [];

        if (affectedRoomIds.some((roomId) => isElementLocked(state, roomId))) {
          return;
        }

        const levelOutline = resolveLevelOutline(level, normalized.standardFloorGroups, normalized.outline);
        const updatedLevel = applyLevelWallDrag(
          level,
          input.wallId,
          input.offset,
          input.normal,
          levelOutline
        );

        if (updatedLevel === level) {
          return;
        }

        const nextLevels = normalized.levels.map((item) =>
          item.id === level.id ? updatedLevel : item
        );
        const nextVersion = {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        };
        const previousVersion = normalized;
        const committedVersion = normalizePlanVersion(nextVersion);

        state.project.versions = state.project.versions.map((item) =>
          item.id === committedVersion.id ? committedVersion : item
        );
        state.project.activeVersionId = committedVersion.id;

        if (previousVersion) {
          recordGeometryVersionChangeSet(state, previousVersion, committedVersion);
        }

        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  mergeSelectedWallWith: (otherWallId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const wallId = state.selectedWallId;

        if (!wallId || !state.activeVersion || wallId === otherWallId) {
          return;
        }

        if (isElementLocked(state, wallId) || isElementLocked(state, otherWallId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = getLevel(normalized, state.activeLevelId);

        if (!level) {
          return;
        }

        const wall = level.walls.find((candidate) => candidate.id === wallId);
        const otherWall = level.walls.find((candidate) => candidate.id === otherWallId);

        if (!wall || !otherWall) {
          return;
        }

        const affectedRoomIds = new Set([...wall.roomIds, ...otherWall.roomIds]);

        if ([...affectedRoomIds].some((roomId) => isElementLocked(state, roomId))) {
          return;
        }

        const updatedLevel = applyLevelWallMerge(level, wallId, otherWallId);

        if (!updatedLevel) {
          return;
        }

        const nextLevels = normalized.levels.map((item) => (item.id === level.id ? updatedLevel : item));
        const nextVersion = {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        };
        const previousVersion = normalized;
        const committedVersion = normalizePlanVersion(nextVersion);

        state.project.versions = state.project.versions.map((item) =>
          item.id === committedVersion.id ? committedVersion : item
        );
        state.project.activeVersionId = committedVersion.id;
        state.selectedWallId = wallId;

        if (previousVersion) {
          recordGeometryVersionChangeSet(state, previousVersion, committedVersion);
        }

        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  splitSelectedWallAt: (param) =>
    set(
      produce<EvoProjectStore>((state) => {
        const wallId = state.selectedWallId;

        if (!wallId || !state.activeVersion) {
          return;
        }

        if (isElementLocked(state, wallId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = getLevel(normalized, state.activeLevelId);

        if (!level) {
          return;
        }

        const wall = level.walls.find((candidate) => candidate.id === wallId);

        if (!wall) {
          return;
        }

        if (wall.roomIds.some((roomId) => isElementLocked(state, roomId))) {
          return;
        }

        const updatedLevel = applyLevelWallSplit(level, wallId, param);

        if (!updatedLevel) {
          return;
        }

        const nextLevels = normalized.levels.map((item) => (item.id === level.id ? updatedLevel : item));
        const nextVersion = {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        };
        const previousVersion = normalized;
        const committedVersion = normalizePlanVersion(nextVersion);

        state.project.versions = state.project.versions.map((item) =>
          item.id === committedVersion.id ? committedVersion : item
        );
        state.project.activeVersionId = committedVersion.id;
        state.selectedWallId = wallId;

        if (previousVersion) {
          recordGeometryVersionChangeSet(state, previousVersion, committedVersion);
        }

        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    ),
  splitActiveRoom: (input) =>
    set(
      produce<EvoProjectStore>((state) => {
        const roomId = state.selectedRoomId;

        if (!roomId || isElementLocked(state, roomId)) {
          return;
        }

        commitTopologyVersionDraft(state, {
          id: `op-split-${Date.now()}`,
          type: "split_room",
          label: `Split ${roomId}`,
          targetRoomIds: [roomId],
          roomId,
          splitAxis: input.axis,
          splitRatio: input.splitRatio,
          secondRoomName: input.secondRoomName
        });
      })
    ),
  mergeActiveRoomWith: (neighborRoomId, mergedName) =>
    set(
      produce<EvoProjectStore>((state) => {
        const roomId = state.selectedRoomId;

        if (!roomId || isElementLocked(state, roomId) || isElementLocked(state, neighborRoomId)) {
          return;
        }

        const room = state.activeVersion?.rooms.find((item) => item.id === roomId);
        const neighbor = state.activeVersion?.rooms.find((item) => item.id === neighborRoomId);

        if (!room || !neighbor) {
          return;
        }

        commitTopologyVersionDraft(state, {
          id: `op-merge-${Date.now()}`,
          type: "merge_room",
          label: `Merge ${room.name} + ${neighbor.name}`,
          targetRoomIds: [roomId, neighborRoomId],
          primaryRoomId: roomId,
          secondaryRoomId: neighborRoomId,
          mergedRoomName: mergedName ?? `${room.name} + ${neighbor.name}`
        });
        state.selectedRoomId = roomId;
      })
    ),
  addParametricOpening: (input) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, input.roomId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const operation: PlanOperation = {
          id: `op-${input.kind}-${Date.now()}`,
          type: "add_opening",
          label: `Add ${input.kind}`,
          targetRoomIds: [input.roomId],
          roomId: input.roomId,
          openingKind: input.kind,
          wall: input.wall,
          position: input.position ?? 0.5,
          width: input.width ?? (input.kind === "door" ? 1 : 1.2)
        };
        const nextVersion = applyPlanOperations(normalized, [operation], { skipPostProcess: true });

        commitNormalizedVersionDraft(
          state,
          normalizePlanVersion(nextVersion),
          false,
          true,
          `Added ${input.kind} to ${input.roomId}`,
          "user"
        );
      })
    ),
  updateWall: (wallId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = getLevel(normalized, state.activeLevelId);

        if (!level?.walls.some((wall) => wall.id === wallId)) {
          return;
        }

        const updatedLevel = applyWallGeometryPatch(level, wallId, patch);
        const nextLevels = normalized.levels.map((item) => (item.id === level.id ? updatedLevel : item));
        const nextVersion = {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        };

        if (patchTouchesGeometry(patch, WALL_GEOMETRY_KEYS)) {
          commitNormalizedVersionDraft(state, normalizePlanVersion(nextVersion));
          return;
        }

        commitNormalizedVersionDraft(state, nextVersion, false, false);
        state.selectedWall = nextLevels
          .flatMap((item) => item.walls)
          .find((wall) => wall.id === state.selectedWallId);
      })
    ),
  updateOpening: (openingId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.activeVersion) {
          return;
        }

        if (isElementLocked(state, openingId)) {
          return;
        }

        const normalized = normalizePlanVersion(state.activeVersion);
        const level = getLevel(normalized, state.activeLevelId);

        if (!level?.openings.some((opening) => opening.id === openingId)) {
          return;
        }

        const nextLevels = normalized.levels.map((item) =>
          item.id === level.id
            ? {
                ...item,
                openings: item.openings.map((opening) =>
                  opening.id === openingId ? { ...opening, ...patch, id: opening.id } : opening
                )
              }
            : item
        );
        const nextVersion = {
          ...normalized,
          levels: nextLevels,
          building: {
            ...normalized.building,
            levels: nextLevels
          }
        };

        if (patchTouchesGeometry(patch, OPENING_GEOMETRY_KEYS)) {
          commitNormalizedVersionDraft(state, normalizePlanVersion(nextVersion));
          return;
        }

        commitNormalizedVersionDraft(state, nextVersion, false, false);
        state.selectedOpening = nextLevels
          .flatMap((item) => item.openings)
          .find((opening) => opening.id === state.selectedOpeningId);
      })
    )
});
