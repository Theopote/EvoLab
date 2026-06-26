import { describe, expect, it } from "vitest";
import { createStoredCopilotProposal, revertCopilotProposalAfterUndo } from "@/lib/copilot-proposals";
import type { ProjectDomain } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";

const baseVersion = {
  id: "v1",
  label: "Base",
  createdAt: "2026-01-01T00:00:00.000Z",
  rooms: [],
  levels: [],
  building: {} as PlanVersion["building"],
  outline: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ],
  overallBounds: { width: 10, height: 10 }
} as PlanVersion;

const proposal = {
  intent: "Move core north",
  constraints: [],
  targetElementIds: [],
  operations: []
} as unknown as PlanChangeProposal;

describe("revertCopilotProposalAfterUndo", () => {
  it("returns an applied proposal to draft", () => {
    const stored = createStoredCopilotProposal({
      prompt: "Move core north",
      baseVersion,
      proposal,
      findings: []
    });

    const applied = {
      ...stored,
      status: "applied" as const,
      resultVersionId: "v2",
      changeSetId: "changeset-1"
    };

    const domain = {
      changeSets: [],
      copilotProposals: [applied]
    } as unknown as ProjectDomain;

    const next = revertCopilotProposalAfterUndo(domain, applied.id);
    const reverted = next.copilotProposals[0];

    expect(reverted?.status).toBe("draft");
    expect(reverted?.resultVersionId).toBeUndefined();
    expect(reverted?.changeSetId).toBeUndefined();
    expect(reverted?.auditLog.at(-1)?.action).toBe("reverted");
  });
});
