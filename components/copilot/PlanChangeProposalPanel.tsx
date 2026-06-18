"use client";

import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buildPreviewVersion, operationSummary } from "@/lib/plan-change-engine";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion } from "@/lib/project-types";

interface PlanChangeProposalPanelProps {
  baseVersion: PlanVersion;
  proposal: PlanChangeProposal;
  onApply: (version: PlanVersion, acceptedOperationIds: string[]) => void;
  onDismiss: () => void;
}

export function PlanChangeProposalPanel({
  baseVersion,
  proposal,
  onApply,
  onDismiss
}: PlanChangeProposalPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(
    () => new Set(proposal.operations.map((operation) => operation.id))
  );

  const preview = useMemo(
    () =>
      buildPreviewVersion(baseVersion, proposal, {
        acceptedOperationIds: [...acceptedIds],
        versionLabel: `${baseVersion.label} / Copilot (${acceptedIds.size}/${proposal.operations.length})`
      }),
    [acceptedIds, baseVersion, proposal]
  );

  function toggleOperation(operationId: string) {
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

          <div className="space-y-1.5">
            {proposal.operations.map((operation) => {
              const checked = acceptedIds.has(operation.id);

              return (
                <label
                  className={`flex cursor-pointer gap-2 rounded border p-2 text-[11px] ${
                    checked ? "border-accent/40 bg-accent/10" : "border-line bg-[#0b1118] opacity-70"
                  }`}
                  key={operation.id}
                >
                  <input
                    checked={checked}
                    className="mt-0.5"
                    type="checkbox"
                    onChange={() => toggleOperation(operation.id)}
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-slate-100">{operation.label}</span>
                    <span className="mt-0.5 block text-muted">{operationSummary(operation)}</span>
                    {operation.rationale ? (
                      <span className="mt-0.5 block leading-4 text-slate-400">{operation.rationale}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

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
              onClick={() => setAcceptedIds(new Set(proposal.operations.map((operation) => operation.id)))}
            >
              Select all
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
