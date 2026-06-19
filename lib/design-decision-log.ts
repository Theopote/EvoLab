import type { PlanVersion } from "@/lib/project-types";

export type DesignDecisionTrigger = "user_instruction" | "ai_suggestion_accepted" | "manual_edit";

export interface DesignDecision {
  id: string;
  trigger: DesignDecisionTrigger;
  description: string;
  affectedRoomIds: string[];
  versionIdBefore: string;
  versionIdAfter: string;
  createdAt: string;
}

export function createDesignDecision(input: {
  trigger: DesignDecisionTrigger;
  description: string;
  affectedRoomIds?: string[];
  versionIdBefore: string;
  versionIdAfter: string;
}): DesignDecision {
  return {
    id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    trigger: input.trigger,
    description: input.description,
    affectedRoomIds: input.affectedRoomIds ?? [],
    versionIdBefore: input.versionIdBefore,
    versionIdAfter: input.versionIdAfter,
    createdAt: new Date().toISOString()
  };
}

export function appendDesignDecision(
  decisions: DesignDecision[] | undefined,
  decision: DesignDecision,
  max = 40
): DesignDecision[] {
  return [decision, ...(decisions ?? [])].slice(0, max);
}

export function designDecisionsForVersion(decisions: DesignDecision[] | undefined, versionId: string) {
  return (decisions ?? []).filter(
    (decision) => decision.versionIdAfter === versionId || decision.versionIdBefore === versionId
  );
}

export function summarizeDesignIntent(decisions: DesignDecision[] | undefined, limit = 4): string[] {
  return (decisions ?? []).slice(0, limit).map((decision) => decision.description);
}

export function diffRoomIds(before: PlanVersion, after: PlanVersion) {
  const beforeIds = new Set(before.rooms.map((room) => room.id));
  const afterIds = new Set(after.rooms.map((room) => room.id));
  const changed = after.rooms
    .filter((room) => {
      const previous = before.rooms.find((item) => item.id === room.id);
      return !previous || JSON.stringify(previous.polygon) !== JSON.stringify(room.polygon);
    })
    .map((room) => room.id);

  return [...new Set([...changed, ...[...afterIds].filter((id) => !beforeIds.has(id))])];
}
