import { summarizeRoomChanges } from "@/lib/plan-change-diff";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";
import type { PlanChangeProposal, PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

export interface HybridProposalMeta {
  keptFromA: string[];
  keptFromB: string[];
  versionAId: string;
  versionBId: string;
  priority: "A" | "B";
}

export function buildHybridProposal(
  baseVersion: PlanVersion,
  mergedVersion: PlanVersion,
  intent: string,
  meta: HybridProposalMeta
): PlanChangeProposal {
  const changes = summarizeRoomChanges(baseVersion, mergedVersion);
  const changedRoomIds = [...new Set([...changes.added, ...changes.modified, ...changes.removed])];

  return {
    intent,
    constraints: [
      {
        id: "constraint-hybrid-fixed-a",
        label: `Preserve ${meta.keptFromA.length} locked region(s) from scheme A`,
        severity: "hard"
      },
      {
        id: "constraint-hybrid-fixed-b",
        label: `Preserve ${meta.keptFromB.length} locked region(s) from scheme B`,
        severity: "hard"
      }
    ],
    targetElementIds: [...new Set([...meta.keptFromA, ...meta.keptFromB, ...changedRoomIds])],
    operations: [
      {
        id: "op-hybrid-layout",
        type: "replace_rooms",
        label: "Apply hybrid layout",
        rationale: "Merge fixed regions from both schemes and fill the remaining outline.",
        targetRoomIds: changedRoomIds.length ? changedRoomIds : mergedVersion.rooms.map((room) => room.id),
        rooms: mergedVersion.rooms as Extract<PlanOperation, { type: "replace_rooms" }>["rooms"]
      }
    ]
  };
}

export function buildHybridModifyPlanResponse(input: {
  baseVersion: PlanVersion;
  mergedVersion: PlanVersion;
  intent: string;
  meta: HybridProposalMeta;
  findings?: CopilotFinding[];
  warning?: string;
  fallback?: boolean;
  geometryValid?: boolean;
  lockedRoomIds?: string[];
}): ModifyPlanResponse & { geometryValid?: boolean; lockedRoomIds?: string[] } {
  const proposal = buildHybridProposal(input.baseVersion, input.mergedVersion, input.intent, input.meta);
  const version = buildPreviewVersion(input.baseVersion, proposal, {
    versionLabel: `${input.baseVersion.label} / Hybrid preview`
  });

  return {
    mode: "proposal",
    proposal,
    version,
    findings: input.findings ?? [],
    warning: input.warning,
    fallback: input.fallback,
    geometryValid: input.geometryValid,
    lockedRoomIds: input.lockedRoomIds
  };
}
