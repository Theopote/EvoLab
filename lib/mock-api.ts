import { initialProjectData } from "@/lib/evolab-data";
import { generateRuleBasedMep } from "@/lib/mep-router";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type {
  AnalysisLayerId,
  CopilotFinding,
  MepLayout,
  PlanVersion,
  Point
} from "@/lib/project-types";
import { createMockPlanVersionsFromPack } from "@/lib/typology/layouts";
import { resolveTypologyPack } from "@/lib/typology/resolve";

const baseVersion = initialProjectData.versions[0];

export function createMockPlanVersions(outline?: Point[], projectType = "healthcare"): PlanVersion[] {
  const pack = resolveTypologyPack(projectType);
  return createMockPlanVersionsFromPack(pack, outline);
}

export function createMockAnalyzedVersion(): { version: PlanVersion; confidence: number; warnings: string[] } {
  return {
    version: postProcessPlanVersion({
      ...baseVersion,
      id: "analyzed-plan-001",
      label: "Analyzed Plan / Drawing Import",
      createdAt: new Date().toISOString()
    }),
    confidence: 0.78,
    warnings: [
      "No real drawing recognition was run. EvoLab returned mock structured plan data.",
      "Door, window and text annotation confidence values are examples."
    ]
  };
}

export function createMockChangeProposal(currentVersion: PlanVersion, userRequest: string) {
  const shouldMoveCore = /\u6838\u5fc3|core|\u5317/i.test(userRequest);
  const shouldWidenCorridor = /corridor|\u8d70\u5eca|\u52a8\u7ebf/i.test(userRequest);
  const shouldAlignWet = /wet|plumb|\u6c34|\u4e95\u9053|shaft/i.test(userRequest);
  const shouldSplitRoom = /split|divide|\u62c6\u5206|\u5206\u5272/i.test(userRequest);
  const shouldAddOpening = /door|window|\u95e8|\u7a97|opening/i.test(userRequest);

  const coreRooms = currentVersion.rooms.filter(
    (room) => room.type === "elevator" || room.type === "stair" || room.type === "shaft"
  );
  const corridorRooms = currentVersion.rooms.filter((room) => room.type === "corridor");
  const wetRooms = currentVersion.rooms.filter(
    (room) => room.type === "bathroom" || room.type === "kitchen" || room.needsPlumbing
  );
  const splitCandidate =
    currentVersion.rooms.find((room) => room.type === "office" || room.type === "consultation" || room.type === "other") ??
    currentVersion.rooms[0];

  const operations: PlanChangeProposal["operations"] = [];

  if (shouldMoveCore && coreRooms.length > 0) {
    operations.push({
      id: "op-move-core-north",
      type: "move_core",
      label: "Move core toward north",
      rationale: "Matches the request to relocate the building core.",
      targetRoomIds: coreRooms.map((room) => room.id),
      direction: "north",
      distanceMeters: 4
    });
  }

  if (shouldWidenCorridor && corridorRooms.length > 0) {
    operations.push({
      id: "op-widen-corridor",
      type: "widen_corridor",
      label: "Widen main corridor",
      rationale: "Improves circulation width for egress review.",
      targetRoomIds: corridorRooms.map((room) => room.id),
      corridorIds: corridorRooms.slice(0, 2).map((room) => room.id),
      extraWidthMeters: 0.6,
      side: "both"
    });
  }

  if (shouldAlignWet && wetRooms.length > 0) {
    operations.push({
      id: "op-align-wet",
      type: "align_wet_rooms",
      label: "Align wet rooms to shaft",
      rationale: "Keeps plumbing-heavy rooms closer to the service core.",
      targetRoomIds: wetRooms.map((room) => room.id),
      roomIds: wetRooms.slice(0, 3).map((room) => room.id),
      maxDistanceMeters: 10
    });
  }

  if (shouldSplitRoom && splitCandidate) {
    operations.push({
      id: "op-split-room",
      type: "split_room",
      label: `Split ${splitCandidate.name}`,
      rationale: "Divides the target room without rewriting the full plan.",
      targetRoomIds: [splitCandidate.id],
      roomId: splitCandidate.id,
      splitAxis: "vertical",
      splitRatio: 0.55,
      secondRoomName: `${splitCandidate.name} B`
    });
  }

  if (shouldAddOpening && splitCandidate) {
    operations.push({
      id: "op-add-opening",
      type: "add_opening",
      label: `Add door to ${splitCandidate.name}`,
      rationale: "Adds a circulation opening on the selected room edge.",
      targetRoomIds: [splitCandidate.id],
      roomId: splitCandidate.id,
      openingKind: /window|\u7a97/i.test(userRequest) ? "window" : "door",
      wall: "west",
      position: 0.5,
      width: /window|\u7a97/i.test(userRequest) ? 1.5 : 0.9
    });
  }

  if (operations.length === 0) {
    operations.push({
      id: "op-optimize-egress",
      type: "optimize_egress",
      label: "Review egress paths",
      rationale: "No deterministic geometry change inferred; flag egress for follow-up.",
      targetRoomIds: corridorRooms.slice(0, 1).map((room) => room.id),
      note: `Mock review for: ${userRequest}`
    });
  }

  const proposal: PlanChangeProposal = {
    intent: userRequest.trim() || "Apply a conservative Copilot adjustment",
    constraints: [
      {
        id: "constraint-core",
        label: "Preserve at least one stair or elevator core",
        severity: "hard"
      },
      {
        id: "constraint-outline",
        label: "Keep room geometry inside the active outline",
        severity: "hard"
      }
    ],
    targetElementIds: [...new Set(operations.flatMap((operation) => operation.targetRoomIds))],
    operations
  };

  const version = buildPreviewVersion(currentVersion, proposal);
  const findings: CopilotFinding[] = [
    {
      id: "finding-proposal",
      tone: "success",
      text: "Copilot returned a structured change proposal instead of rewriting the full plan.",
      sub: "Review each operation, then apply the selected changes.",
      actions: [{ id: "recalculate-areas", label: "Recalculate areas" }]
    },
    {
      id: "finding-risk",
      tone: version.scores?.riskCount ? "warning" : "success",
      text: version.scores?.riskCount
        ? "Some compliance risks still need later review."
        : "No high-risk item was found by the mock rules.",
      actions: [{ id: "optimize-egress", label: "Optimize egress" }]
    }
  ];

  return { proposal, version, findings };
}

export function createMockModifiedVersion(currentVersion: PlanVersion, userRequest: string) {
  const proposalResult = createMockChangeProposal(currentVersion, userRequest);

  return {
    proposal: proposalResult.proposal,
    version: proposalResult.version,
    findings: proposalResult.findings,
    mode: "proposal" as const
  };
}

export function createMockMep(version: PlanVersion): { mep: MepLayout; findings: CopilotFinding[] } {
  return generateRuleBasedMep(version);
}

export function createMockDiagram(layers: AnalysisLayerId[]) {
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420"><rect width="720" height="420" fill="#0c1117"/><text x="32" y="48" fill="#9fb3c8" font-family="Arial" font-size="22">EvoLab analysis overlay</text></svg>`,
    overlays: {
      layers,
      rooms: baseVersion.rooms.map((room) => ({
        roomId: room.id,
        zone: room.zone,
        polygon: room.polygon
      }))
    }
  };
}
