"use client";

import { MessageSquare, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import type { StoredCopilotProposal } from "@/lib/building-domain";
import { formatCopilotAuditEntry } from "@/lib/copilot-proposals";

interface CopilotProposalHistoryPanelProps {
  proposals: StoredCopilotProposal[];
  activeProposalId?: string;
  onSelectProposal?: (proposalId: string) => void;
}

const statusTone: Record<StoredCopilotProposal["status"], string> = {
  draft: "text-warning",
  applied: "text-success",
  dismissed: "text-muted"
};

export function CopilotProposalHistoryPanel({
  proposals,
  activeProposalId,
  onSelectProposal
}: CopilotProposalHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | undefined>(activeProposalId);

  const visible = useMemo(() => proposals.slice(0, 12), [proposals]);

  if (visible.length === 0) {
    return (
      <div className="flex h-full flex-col rounded border border-line bg-[#0b1118] p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          <ScrollText className="h-3.5 w-3.5" />
          Proposal log
        </div>
        <p className="text-xs leading-5 text-muted">Copilot proposals, comments, and operation audit entries appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-56 flex-col overflow-hidden rounded border border-line bg-[#0b1118]">
      <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5" />
          Proposal log
        </div>
      </div>
      <div className="space-y-2 overflow-auto p-2">
        {visible.map((proposal) => {
          const isExpanded = expandedId === proposal.id;
          const isActive = activeProposalId === proposal.id;

          return (
            <article
              className={`rounded border p-2 ${
                isActive ? "border-accent/50 bg-accent/10" : "border-line bg-panel/70"
              }`}
              key={proposal.id}
            >
              <button
                className="w-full text-left"
                type="button"
                onClick={() => {
                  setExpandedId(isExpanded ? undefined : proposal.id);
                  onSelectProposal?.(proposal.id);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs text-slate-100">{proposal.proposal.intent}</div>
                  <span className={`text-[10px] uppercase ${statusTone[proposal.status]}`}>{proposal.status}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  {new Date(proposal.createdAt).toLocaleString()} · {proposal.proposal.operations.length} ops
                </div>
              </button>

              {isExpanded ? (
                <div className="mt-2 space-y-2 border-t border-line pt-2">
                  {proposal.comments.length ? (
                    <div>
                      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                        <MessageSquare className="h-3 w-3" />
                        Comments
                      </div>
                      <ul className="space-y-1 text-[11px] text-slate-300">
                        {proposal.comments.map((comment) => (
                          <li key={comment.id}>
                            <span className="text-muted">{comment.author}:</span> {comment.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-[0.1em] text-muted">Audit</div>
                    <ul className="max-h-28 space-y-1 overflow-auto text-[11px] text-slate-300">
                      {proposal.auditLog.slice(-12).map((entry) => (
                        <li key={entry.id}>
                          <span className="text-muted">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                          {" · "}
                          {formatCopilotAuditEntry(entry)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
