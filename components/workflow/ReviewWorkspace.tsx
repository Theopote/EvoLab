"use client";

import { CopilotProposalHistoryPanel } from "@/components/copilot/CopilotProposalHistoryPanel";
import { ChangeSetApprovalPanel } from "@/components/quantity/ChangeSetApprovalPanel";
import type { ChangeSet, StoredCopilotProposal } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";

interface ReviewWorkspaceProps {
  changeSets: ChangeSet[];
  copilotProposals: StoredCopilotProposal[];
  versions: PlanVersion[];
  selectedChangeSetId?: string;
  lockedElementIds: string[];
  onSelectChangeSet: (changeSetId: string) => void;
  onApproveChangeSet: (changeSetId: string, lockChangedElements: boolean) => void;
  onRejectChangeSet: (changeSetId: string) => void;
  onToggleElementLock: (elementId: string) => void;
}

export function ReviewWorkspace({
  changeSets,
  copilotProposals,
  versions,
  selectedChangeSetId,
  lockedElementIds,
  onSelectChangeSet,
  onApproveChangeSet,
  onRejectChangeSet,
  onToggleElementLock
}: ReviewWorkspaceProps) {
  const draftProposals = copilotProposals.filter((item) => item.status === "draft");
  const pendingChangeSets = changeSets.filter((item) => item.status === "draft");

  return (
    <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
      <header className="rounded border border-line bg-panel/90 px-4 py-3">
        <h1 className="text-base font-semibold text-white">Design Review</h1>
        <p className="mt-1 text-xs text-muted">
          {pendingChangeSets.length} pending change set{pendingChangeSets.length === 1 ? "" : "s"} ·{" "}
          {draftProposals.length} draft Copilot proposal{draftProposals.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] gap-4">
        <ChangeSetApprovalPanel
          changeSets={changeSets}
          versions={versions}
          selectedChangeSetId={selectedChangeSetId}
          lockedElementIds={lockedElementIds}
          onSelectChangeSet={onSelectChangeSet}
          onApprove={onApproveChangeSet}
          onReject={onRejectChangeSet}
          onToggleElementLock={onToggleElementLock}
        />

        <section className="flex min-h-0 flex-col overflow-hidden rounded border border-line bg-panel/90">
          <div className="border-b border-line px-3 py-3">
            <h2 className="text-sm font-semibold text-white">Copilot proposals</h2>
            <p className="mt-1 text-xs text-muted">
              Operation-level proposals are reviewed in Copilot console; this log tracks status and audit history.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <CopilotProposalHistoryPanel proposals={copilotProposals} />
          </div>
        </section>
      </div>
    </section>
  );
}
