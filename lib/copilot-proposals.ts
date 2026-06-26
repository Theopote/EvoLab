import type {
  CopilotProposalAuditAction,
  CopilotProposalAuditEntry,
  CopilotProposalComment,
  ProjectDomain,
  StoredCopilotProposal
} from "@/lib/building-domain";
import { getBlockedLocksForOperation } from "@/lib/plan-change-engine";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

const MAX_PROPOSALS = 40;

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function auditEntry(
  action: CopilotProposalAuditAction,
  input: Omit<CopilotProposalAuditEntry, "id" | "action" | "createdAt">
): CopilotProposalAuditEntry {
  return {
    id: createId("audit"),
    createdAt: new Date().toISOString(),
    action,
    ...input
  };
}

export function createStoredCopilotProposal(input: {
  prompt: string;
  baseVersion: PlanVersion;
  proposal: PlanChangeProposal;
  findings: CopilotFinding[];
  warning?: string;
}): StoredCopilotProposal {
  const auditLog = input.proposal.operations.map((operation) =>
    auditEntry("proposed", {
      operationId: operation.id,
      operationLabel: operation.label,
      actor: "copilot"
    })
  );

  return {
    id: createId("copilot-proposal"),
    prompt: input.prompt,
    status: "draft",
    baseVersionId: input.baseVersion.id,
    proposal: input.proposal,
    findings: input.findings,
    acceptedOperationIds: [],
    auditLog,
    comments: [],
    createdAt: new Date().toISOString(),
    warning: input.warning,
    baseVersionSnapshot: input.baseVersion
  };
}

export function appendCopilotProposal(domain: ProjectDomain, proposal: StoredCopilotProposal): ProjectDomain {
  return {
    ...domain,
    copilotProposals: [proposal, ...domain.copilotProposals].slice(0, MAX_PROPOSALS)
  };
}

export function getCopilotProposal(domain: ProjectDomain, proposalId: string) {
  return domain.copilotProposals.find((item) => item.id === proposalId);
}

export function pendingCopilotProposals(domain: ProjectDomain) {
  return domain.copilotProposals.filter((item) => item.status === "draft");
}

export function resolveProposalOperationSets(
  proposal: PlanChangeProposal,
  acceptedOperationIds: string[],
  lockedElementIds: string[],
  baseVersion: PlanVersion
) {
  const accepted = new Set(acceptedOperationIds);
  const rejected: string[] = [];
  const skippedLocked: string[] = [];

  proposal.operations.forEach((operation) => {
    if (accepted.has(operation.id)) {
      return;
    }

    const blocked = getBlockedLocksForOperation(operation, lockedElementIds, baseVersion);

    if (blocked.length) {
      skippedLocked.push(operation.id);
      return;
    }

    rejected.push(operation.id);
  });

  return { acceptedOperationIds, rejectedOperationIds: rejected, skippedOperationIds: skippedLocked };
}

export function markCopilotProposalApplied(
  domain: ProjectDomain,
  proposalId: string,
  input: {
    resultVersionId: string;
    changeSetId: string;
    acceptedOperationIds: string[];
    rejectedOperationIds: string[];
    skippedOperationIds: string[];
  }
): ProjectDomain {
  const now = new Date().toISOString();

  return {
    ...domain,
    copilotProposals: domain.copilotProposals.map((item) => {
      if (item.id !== proposalId) {
        return item;
      }

      const operationById = new Map(item.proposal.operations.map((operation) => [operation.id, operation]));
      const nextAudit = [...item.auditLog];

      input.acceptedOperationIds.forEach((operationId) => {
        const operation = operationById.get(operationId);
        nextAudit.push(
          auditEntry("accepted", {
            operationId,
            operationLabel: operation?.label,
            actor: "user"
          })
        );
      });

      input.rejectedOperationIds.forEach((operationId) => {
        const operation = operationById.get(operationId);
        nextAudit.push(
          auditEntry("rejected", {
            operationId,
            operationLabel: operation?.label,
            actor: "user"
          })
        );
      });

      input.skippedOperationIds.forEach((operationId) => {
        const operation = operationById.get(operationId);
        nextAudit.push(
          auditEntry("skipped_locked", {
            operationId,
            operationLabel: operation?.label,
            actor: "system",
            detail: "Target elements are locked."
          })
        );
      });

      nextAudit.push(
        auditEntry("applied", {
          actor: "user",
          detail: `Applied ${input.acceptedOperationIds.length} operation(s).`
        })
      );

      return {
        ...item,
        status: "applied" as const,
        resultVersionId: input.resultVersionId,
        changeSetId: input.changeSetId,
        acceptedOperationIds: input.acceptedOperationIds,
        reviewedAt: now,
        auditLog: nextAudit
      };
    })
  };
}

export function revertCopilotProposalAfterUndo(domain: ProjectDomain, proposalId: string): ProjectDomain {
  const now = new Date().toISOString();

  return {
    ...domain,
    copilotProposals: domain.copilotProposals.map((item) =>
      item.id === proposalId
        ? {
            ...item,
            status: "draft" as const,
            resultVersionId: undefined,
            changeSetId: undefined,
            reviewedAt: now,
            auditLog: [
              ...item.auditLog,
              auditEntry("reverted", {
                actor: "user",
                detail: "Applied proposal was undone."
              })
            ]
          }
        : item
    )
  };
}

export function dismissCopilotProposal(domain: ProjectDomain, proposalId: string): ProjectDomain {
  const now = new Date().toISOString();

  return {
    ...domain,
    copilotProposals: domain.copilotProposals.map((item) =>
      item.id === proposalId
        ? {
            ...item,
            status: "dismissed" as const,
            reviewedAt: now,
            auditLog: [
              ...item.auditLog,
              auditEntry("dismissed", {
                actor: "user",
                detail: "Proposal dismissed without applying."
              })
            ]
          }
        : item
    )
  };
}

export function addCopilotProposalComment(
  domain: ProjectDomain,
  proposalId: string,
  text: string,
  author = "user"
): ProjectDomain {
  const trimmed = text.trim();

  if (!trimmed) {
    return domain;
  }

  const comment: CopilotProposalComment = {
    id: createId("comment"),
    author,
    text: trimmed,
    createdAt: new Date().toISOString()
  };

  return {
    ...domain,
    copilotProposals: domain.copilotProposals.map((item) =>
      item.id === proposalId
        ? {
            ...item,
            comments: [...item.comments, comment],
            auditLog: [
              ...item.auditLog,
              auditEntry("commented", {
                actor: author,
                detail: trimmed
              })
            ]
          }
        : item
    )
  };
}

export function formatCopilotAuditEntry(entry: CopilotProposalAuditEntry) {
  const label = entry.operationLabel ?? entry.operationId ?? "proposal";

  switch (entry.action) {
    case "proposed":
      return `Proposed · ${label}`;
    case "accepted":
      return `Accepted · ${label}`;
    case "rejected":
      return `Rejected · ${label}`;
    case "skipped_locked":
      return `Skipped (locked) · ${label}`;
    case "commented":
      return `Comment · ${entry.detail ?? ""}`;
    case "applied":
      return entry.detail ?? "Applied proposal";
    case "dismissed":
      return entry.detail ?? "Dismissed proposal";
    default:
      return label;
  }
}
