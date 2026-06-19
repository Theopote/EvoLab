"use client";

import { GitCompareArrows } from "lucide-react";
import { useMemo } from "react";
import { PlanChangeProposalDiffPreview } from "@/components/copilot/PlanChangeProposalDiffPreview";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import type { StoredCopilotProposal } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";

interface ProposalReviewPanelProps {
  proposal: StoredCopilotProposal;
  baseVersion: PlanVersion;
  lockedElementIds: string[];
  onOpenCompare?: () => void;
}

export function ProposalReviewPanel({
  proposal,
  baseVersion,
  lockedElementIds,
  onOpenCompare
}: ProposalReviewPanelProps) {
  const acceptedIds =
    proposal.acceptedOperationIds.length > 0
      ? proposal.acceptedOperationIds
      : proposal.proposal.operations.map((operation) => operation.id);

  const previewVersion = useMemo(
    () =>
      buildPreviewVersion(baseVersion, proposal.proposal, {
        acceptedOperationIds: acceptedIds,
        lockedElementIds,
        versionLabel: `${baseVersion.label} / Proposal preview`
      }),
    [acceptedIds, baseVersion, lockedElementIds, proposal.proposal]
  );

  return (
    <section className="rounded border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <GitCompareArrows className="h-4 w-4 text-accent" />
            Copilot proposal diff
          </h2>
          <p className="mt-1 text-xs text-muted">{proposal.proposal.intent}</p>
          <p className="mt-1 text-[11px] text-muted">
            {proposal.proposal.operations.length} operations · status {proposal.status}
          </p>
        </div>
        {onOpenCompare ? (
          <button
            className="h-8 rounded border border-accent/50 px-3 text-xs text-accent hover:bg-accent/10"
            type="button"
            onClick={onOpenCompare}
          >
            Open in Compare
          </button>
        ) : null}
      </div>

      <PlanChangeProposalDiffPreview baseVersion={baseVersion} previewVersion={previewVersion} />

      <ul className="mt-3 space-y-1.5">
        {proposal.proposal.operations.map((operation) => (
          <li className="rounded border border-line bg-[#0b1118] px-2 py-1.5 text-xs text-slate-200" key={operation.id}>
            {operation.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
