"use client";

import { Check, ChevronDown, ChevronUp, Lock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PlanChangeProposalDiffPreview } from "@/components/copilot/PlanChangeProposalDiffPreview";
import { getHighlightedRoomIds } from "@/lib/plan-change-diff";
import {
  applyPlanOperationsWithReport,
  buildPreviewVersion,
  getBlockedLocksForOperation,
  isOperationBlockedByLocks,
  operationSummary
} from "@/lib/plan-change-engine";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion } from "@/lib/project-types";

interface PlanChangeProposalPanelProps {
  baseVersion: PlanVersion;
  proposal: PlanChangeProposal;
  lockedElementIds?: string[];
  allowedRoomIds?: string[];
  onApply: (version: PlanVersion, acceptedOperationIds: string[]) => void;
  onDismiss: () => void;
  onAddComment?: (text: string) => void;
}

export function PlanChangeProposalPanel({
  baseVersion,
  proposal,
  lockedElementIds = [],
  allowedRoomIds,
  onApply,
  onDismiss,
  onAddComment
}: PlanChangeProposalPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [hoveredOperationId, setHoveredOperationId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(() => {
    const unlocked = proposal.operations
      .filter((operation) => !isOperationBlockedByLocks(operation, lockedElementIds, baseVersion))
      .map((operation) => operation.id);

    return new Set(unlocked);
  });

  useEffect(() => {
    setAcceptedIds(
      new Set(
        proposal.operations
          .filter((operation) => !isOperationBlockedByLocks(operation, lockedElementIds, baseVersion))
          .map((operation) => operation.id)
      )
    );
  }, [baseVersion, proposal, lockedElementIds]);

  const preview = useMemo(
    () =>
      buildPreviewVersion(baseVersion, proposal, {
        acceptedOperationIds: [...acceptedIds],
        lockedElementIds,
        allowedRoomIds,
        versionLabel: `${baseVersion.label} / Copilot (${acceptedIds.size}/${proposal.operations.length})`
      }),
    [acceptedIds, allowedRoomIds, baseVersion, lockedElementIds, proposal]
  );

  const report = useMemo(
    () =>
      applyPlanOperationsWithReport(baseVersion, proposal.operations, {
        acceptedOperationIds: [...acceptedIds],
        lockedElementIds,
        allowedRoomIds,
        skipPostProcess: true
      }),
    [acceptedIds, allowedRoomIds, baseVersion, lockedElementIds, proposal.operations]
  );

  const focusedRoomIds = useMemo(() => {
    if (!hoveredOperationId) {
      return [];
    }

    return getHighlightedRoomIds(baseVersion, preview, [hoveredOperationId], proposal.operations);
  }, [baseVersion, hoveredOperationId, preview, proposal.operations]);

  const highlightRoomIds = useMemo(
    () => getHighlightedRoomIds(baseVersion, preview, [...acceptedIds], proposal.operations),
    [acceptedIds, baseVersion, preview, proposal.operations]
  );

  function toggleOperation(operationId: string, blocked: boolean) {
    if (blocked) {
      return;
    }

    setAcceptedIds((current) => {
      const next = new Set(current);

      if (next.has(operationId)) {
        next.delete(operationId);
      } else {
        next.add(operationId);
      }

      return next;
    });
  }

  return (
    <div className="rounded border border-accent/30 bg-accent/5 p-2">
      <button
        className="flex w-full items-center justify-between gap-2 text-left"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="min-w-0">
          <div className="text-xs font-medium text-accent">Change proposal</div>
          <div className="mt-0.5 truncate text-[11px] text-slate-200">{proposal.intent}</div>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />}
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2">
          <PlanChangeProposalDiffPreview
            baseVersion={baseVersion}
            focusedRoomIds={focusedRoomIds}
            highlightRoomIds={highlightRoomIds}
            previewVersion={preview}
          />

          {proposal.constraints.length ? (
            <div className="rounded border border-line bg-[#0b1118] p-2">
              <div className="mb-1 text-[11px] font-medium text-muted">Constraints</div>
              <ul className="space-y-1 text-[11px] text-slate-300">
                {proposal.constraints.map((constraint) => (
                  <li key={constraint.id}>
                    <span className={constraint.severity === "hard" ? "text-warning" : "text-accent"}>
                      {constraint.severity}
                    </span>
                    {" · "}
                    {constraint.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {report.skippedOperations.length ? (
            <div className="rounded border border-warning/30 bg-warning/5 p-2 text-[11px] text-warning">
              {report.skippedOperations.map((item) => (
                <div key={item.operationId}>
                  {item.label}
                  {item.reason ? ` — ${item.reason}` : " skipped because target elements are locked."}
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-1.5">
            {proposal.operations.map((operation) => {
              const checked = acceptedIds.has(operation.id);
              const blockedLocks = getBlockedLocksForOperation(operation, lockedElementIds, baseVersion);
              const blocked = blockedLocks.length > 0;

              return (
                <label
                  className={`flex gap-2 rounded border p-2 text-[11px] ${
                    blocked
                      ? "cursor-not-allowed border-line bg-[#0b1118] opacity-50"
                      : checked
                        ? "cursor-pointer border-accent/40 bg-accent/10"
                        : "cursor-pointer border-line bg-[#0b1118] opacity-80"
                  }`}
                  key={operation.id}
                  onMouseEnter={() => setHoveredOperationId(operation.id)}
                  onMouseLeave={() => setHoveredOperationId(null)}
                >
                  <input
                    checked={checked}
                    className="mt-0.5"
                    disabled={blocked}
                    type="checkbox"
                    onChange={() => toggleOperation(operation.id, blocked)}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-medium text-slate-100">
                      {operation.label}
                      {blocked ? <Lock className="h-3 w-3 text-warning" /> : null}
                    </span>
                    <span className="mt-0.5 block text-muted">{operationSummary(operation)}</span>
                    {operation.rationale ? (
                      <span className="mt-0.5 block leading-4 text-slate-400">{operation.rationale}</span>
                    ) : null}
                    {blocked ? (
                      <span className="mt-0.5 block text-warning">
                        Locked: {blockedLocks.join(", ")}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

          {onAddComment ? (
            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                const text = commentInput.trim();

                if (!text) {
                  return;
                }

                onAddComment(text);
                setCommentInput("");
              }}
            >
              <input
                className="h-8 min-w-0 flex-1 rounded border border-line bg-[#0b1118] px-2 text-[11px] text-slate-100 outline-none focus:border-accent/70"
                placeholder="Add a review comment..."
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
              />
              <button
                className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:text-accent"
                disabled={!commentInput.trim()}
                type="submit"
              >
                Comment
              </button>
            </form>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            <button
              className="inline-flex items-center gap-1 rounded border border-accent/50 bg-accent/15 px-2 py-1 text-[11px] text-accent disabled:cursor-not-allowed disabled:opacity-50"
              disabled={acceptedIds.size === 0}
              type="button"
              onClick={() => onApply(preview, [...acceptedIds])}
            >
              <Check className="h-3 w-3" />
              Apply {acceptedIds.size} selected
            </button>
            <button
              className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:text-slate-200"
              type="button"
              onClick={() =>
                setAcceptedIds(
                  new Set(
                    proposal.operations
                      .filter((operation) => !isOperationBlockedByLocks(operation, lockedElementIds, baseVersion))
                      .map((operation) => operation.id)
                  )
                )
              }
            >
              Select all unlocked
            </button>
            <button
              className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:text-slate-200"
              type="button"
              onClick={onDismiss}
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
