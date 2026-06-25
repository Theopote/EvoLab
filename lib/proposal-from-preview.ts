import { summarizeRoomChanges } from "@/lib/plan-change-diff";
import type { PlanChangeProposal, PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion, Room, RoomProtrusion } from "@/lib/project-types";

export interface BuildProposalFromPreviewOptions {
  allowedRoomIds?: string[];
  focusRoomIds?: string[];
}

function previewOperationId(kind: string, roomId: string) {
  return `op-preview-${kind}-${roomId}`;
}

function roomTouchesScope(roomId: string, options?: BuildProposalFromPreviewOptions) {
  if (options?.focusRoomIds?.length && !options.focusRoomIds.includes(roomId)) {
    return false;
  }

  if (options?.allowedRoomIds?.length && !options.allowedRoomIds.includes(roomId)) {
    return false;
  }

  return true;
}

function newProtrusions(previous: Room, next: Room): RoomProtrusion[] {
  const previousIds = new Set((previous.protrusions ?? []).map((item) => item.id));

  return (next.protrusions ?? []).filter((item) => !previousIds.has(item.id));
}

function buildRoomMetadataPatch(previous: Room, next: Room) {
  const patch: { name?: string; type?: string; zone?: string } = {};

  if (previous.name !== next.name) {
    patch.name = next.name;
  }

  if (previous.type !== next.type) {
    patch.type = next.type;
  }

  if (previous.zone !== next.zone) {
    patch.zone = next.zone;
  }

  return patch;
}

function buildAddedRoomOperation(room: Room): PlanOperation {
  return {
    id: previewOperationId("add", room.id),
    type: "add_room",
    label: `Add ${room.name}`,
    rationale: "Adds a newly recognized or generated room.",
    targetRoomIds: [room.id],
    room: {
      id: room.id,
      name: room.name,
      type: room.type,
      zone: room.zone,
      polygon: room.polygon,
      areaSqm: room.areaSqm,
      doors: room.doors ?? [],
      windows: room.windows ?? []
    }
  };
}

function buildModifiedRoomOperations(previous: Room, next: Room): PlanOperation[] {
  const operations: PlanOperation[] = [];
  const protrusions = newProtrusions(previous, next);

  protrusions.forEach((protrusion) => {
    operations.push({
      id: previewOperationId(`protrusion-${protrusion.id}`, next.id),
      type: "add_protrusion",
      label: `Add ${protrusion.type.replace("_", " ")} to ${next.name}`,
      rationale: "Applies a protrusion union to the host room.",
      targetRoomIds: [next.id],
      roomId: next.id,
      protrusion
    });
  });

  const metadataPatch = buildRoomMetadataPatch(previous, next);

  if (Object.keys(metadataPatch).length > 0) {
    operations.push({
      id: previewOperationId("metadata", next.id),
      type: "update_room",
      label: `Update ${next.name} metadata`,
      rationale: "Updates recognized room labels without rewriting unrelated geometry.",
      targetRoomIds: [next.id],
      roomId: next.id,
      patch: metadataPatch
    });
  }

  if (
    protrusions.length === 0 &&
    JSON.stringify(previous.polygon) !== JSON.stringify(next.polygon)
  ) {
    operations.push({
      id: previewOperationId("polygon", next.id),
      type: "update_room_polygon",
      label: `Reshape ${next.name}`,
      rationale: "Updates room geometry produced by the local edit preview.",
      targetRoomIds: [next.id],
      roomId: next.id,
      polygon: next.polygon
    });
  }

  return operations;
}

export function buildProposalFromVersionPreview(
  baseVersion: PlanVersion,
  previewVersion: PlanVersion,
  intent: string,
  options?: BuildProposalFromPreviewOptions
): PlanChangeProposal | undefined {
  const changes = summarizeRoomChanges(baseVersion, previewVersion);
  const operations: PlanOperation[] = [];

  changes.added.forEach((roomId) => {
    if (!roomTouchesScope(roomId, options)) {
      return;
    }

    const room = previewVersion.rooms.find((item) => item.id === roomId);

    if (room) {
      operations.push(buildAddedRoomOperation(room));
    }
  });

  changes.modified.forEach((roomId) => {
    if (!roomTouchesScope(roomId, options)) {
      return;
    }

    const previous = baseVersion.rooms.find((item) => item.id === roomId);
    const next = previewVersion.rooms.find((item) => item.id === roomId);

    if (previous && next) {
      operations.push(...buildModifiedRoomOperations(previous, next));
    }
  });

  if (!operations.length) {
    return undefined;
  }

  return {
    intent,
    constraints: [
      {
        id: "constraint-preview-scope",
        label: "Apply only the previewed local edit operations",
        severity: "hard"
      }
    ],
    targetElementIds: [...new Set(operations.flatMap((operation) => operation.targetRoomIds))],
    operations
  };
}

export function defaultAcceptedOperationIdsForSketch(
  proposal: PlanChangeProposal,
  recognizedRoomIdsNeedingReview: string[]
) {
  const blocked = new Set(recognizedRoomIdsNeedingReview);

  return proposal.operations
    .filter((operation) => !operation.targetRoomIds.some((roomId) => blocked.has(roomId)))
    .map((operation) => operation.id);
}
