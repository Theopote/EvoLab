import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import {
  addCopilotProposalComment,
  createStoredCopilotProposal,
  dismissCopilotProposal,
  markCopilotProposalApplied,
  resolveProposalOperationSets
} from "@/lib/copilot-proposals";
import { createDefaultProjectDomain } from "@/lib/project-domain";
import { defaultZoningConstraints } from "@/lib/site-types";

const baseVersion = initialProjectData.versions[0]!;

function emptyDomain() {
  return createDefaultProjectDomain({
    projectType: "healthcare",
    brief: {
      projectType: "healthcare",
      description: "",
      floors: 1,
      targetArea: 1000,
      corePreference: "",
      orientationPreference: ""
    },
    outline: baseVersion.outline,
    zoning: defaultZoningConstraints,
    activeVersion: baseVersion
  });
}

describe("copilot-proposals", () => {
  it("creates proposed audit entries for each operation", () => {
    const stored = createStoredCopilotProposal({
      prompt: "Move core north",
      baseVersion,
      proposal: {
        intent: "Move core north",
        constraints: [],
        targetElementIds: ["core-01"],
        operations: [
          {
            id: "op-1",
            type: "move_core",
            label: "Move core",
            targetRoomIds: ["core-01"],
            direction: "north",
            distanceMeters: 2
          }
        ]
      },
      findings: []
    });

    expect(stored.status).toBe("draft");
    expect(stored.auditLog).toHaveLength(1);
    expect(stored.auditLog[0]?.action).toBe("proposed");
  });

  it("records accepted, rejected, and applied audit entries", () => {
    const stored = createStoredCopilotProposal({
      prompt: "Adjust plan",
      baseVersion,
      proposal: {
        intent: "Adjust plan",
        constraints: [],
        targetElementIds: ["office-01", "corridor-01"],
        operations: [
          {
            id: "op-office",
            type: "shift_rooms",
            label: "Shift office",
            targetRoomIds: ["office-01"],
            roomIds: ["office-01"],
            dx: 1,
            dy: 0
          },
          {
            id: "op-corridor",
            type: "widen_corridor",
            label: "Widen corridor",
            targetRoomIds: ["corridor-01"],
            corridorIds: ["corridor-01"],
            extraWidthMeters: 0.4,
            side: "both"
          }
        ]
      },
      findings: []
    });

    let domain = emptyDomain();
    domain = {
      ...domain,
      copilotProposals: [stored]
    };

    const operationSets = resolveProposalOperationSets(
      stored.proposal,
      ["op-corridor"],
      [],
      baseVersion
    );

    domain = markCopilotProposalApplied(domain, stored.id, {
      resultVersionId: "scheme-a-proposal-1",
      changeSetId: "changeset-1",
      ...operationSets
    });

    const applied = domain.copilotProposals[0];

    expect(applied?.status).toBe("applied");
    expect(applied?.acceptedOperationIds).toEqual(["op-corridor"]);
    expect(applied?.auditLog.some((entry) => entry.action === "accepted")).toBe(true);
    expect(applied?.auditLog.some((entry) => entry.action === "rejected")).toBe(true);
    expect(applied?.auditLog.some((entry) => entry.action === "applied")).toBe(true);
  });

  it("stores review comments and dismiss audit", () => {
    const stored = createStoredCopilotProposal({
      prompt: "Review only",
      baseVersion,
      proposal: {
        intent: "Review only",
        constraints: [],
        targetElementIds: [],
        operations: [
          {
            id: "op-egress",
            type: "optimize_egress",
            label: "Review egress",
            targetRoomIds: [],
            note: "Check paths"
          }
        ]
      },
      findings: []
    });

    let domain = { ...emptyDomain(), copilotProposals: [stored] };
    domain = addCopilotProposalComment(domain, stored.id, "Need wider corridor first");
    domain = dismissCopilotProposal(domain, stored.id);

    const next = domain.copilotProposals[0];

    expect(next?.comments).toHaveLength(1);
    expect(next?.status).toBe("dismissed");
    expect(next?.auditLog.some((entry) => entry.action === "commented")).toBe(true);
    expect(next?.auditLog.some((entry) => entry.action === "dismissed")).toBe(true);
  });
});
