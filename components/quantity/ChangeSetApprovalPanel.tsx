"use client";

import { Check, GitCompareArrows, Lock, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChangeSet, ChangeStatus } from "@/lib/building-domain";
import { countChangesByType, formatElementChange } from "@/lib/project-domain";
import type { PlanVersion } from "@/lib/project-types";

interface ChangeSetApprovalPanelProps {
  changeSets: ChangeSet[];
  versions: PlanVersion[];
  selectedChangeSetId?: string;
  lockedElementIds: string[];
  onSelectChangeSet: (changeSetId: string) => void;
  onApprove: (changeSetId: string, lockChangedElements: boolean) => void;
  onReject: (changeSetId: string) => void;
  onToggleElementLock: (elementId: string) => void;
}

const statusTone: Record<ChangeStatus, string> = {
  draft: "border-warning/40 text-warning",
  approved: "border-success/40 text-success",
  rejected: "border-danger/40 text-danger",
  applied: "border-accent/40 text-accent"
};

export function ChangeSetApprovalPanel({
  changeSets,
  versions,
  selectedChangeSetId,
  lockedElementIds,
  onSelectChangeSet,
  onApprove,
  onReject,
  onToggleElementLock
}: ChangeSetApprovalPanelProps) {
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [lockOnApprove, setLockOnApprove] = useState(true);

  const visibleChangeSets = useMemo(
    () => (filter === "pending" ? changeSets.filter((item) => item.status === "draft") : changeSets),
    [changeSets, filter]
  );

  const selectedChangeSet =
    changeSets.find((item) => item.id === selectedChangeSetId) ?? visibleChangeSets[0] ?? changeSets[0];
  const pendingCount = changeSets.filter((item) => item.status === "draft").length;

  if (changeSets.length === 0) {
    return (
      <section className="rounded border border-line bg-panel/90 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <GitCompareArrows className="h-4 w-4 text-accent" />
          ChangeSet Review
        </div>
        <p className="text-xs leading-5 text-muted">
          AI relayout, generated schemes, and tracked geometry edits will appear here for approval.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded border border-line bg-panel/90">
      <div className="border-b border-line px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <GitCompareArrows className="h-4 w-4 text-accent" />
              ChangeSet Review
            </h2>
            <p className="mt-1 text-xs text-muted">
              {pendingCount} pending · {changeSets.length} total
            </p>
          </div>
          <select
            className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
            value={filter}
            onChange={(event) => setFilter(event.target.value as "pending" | "all")}
          >
            <option value="pending">Pending only</option>
            <option value="all">All changes</option>
          </select>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
        <div className="max-h-44 overflow-auto border-b border-line p-2">
          <div className="space-y-2">
            {visibleChangeSets.map((changeSet) => {
              const isSelected = selectedChangeSet?.id === changeSet.id;
              const counts = countChangesByType(changeSet.changes);

              return (
                <button
                  className={`w-full rounded border p-2 text-left ${
                    isSelected ? "border-accent/60 bg-accent/10" : "border-line bg-[#0b1118] hover:border-accent/30"
                  }`}
                  key={changeSet.id}
                  type="button"
                  onClick={() => onSelectChangeSet(changeSet.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-slate-100">{changeSet.summary}</span>
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${statusTone[changeSet.status]}`}>
                      {changeSet.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {changeSet.source} · {changeSet.changes.length} edits · +{counts.add} ~{counts.update} -{counts.remove}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedChangeSet ? (
          <ChangeSetDetail
            changeSet={selectedChangeSet}
            versions={versions}
            lockOnApprove={lockOnApprove}
            lockedElementIds={lockedElementIds}
            onApprove={onApprove}
            onReject={onReject}
            onToggleElementLock={onToggleElementLock}
            onLockOnApproveChange={setLockOnApprove}
          />
        ) : (
          <div className="grid flex-1 place-items-center p-4 text-xs text-muted">No changes in this filter.</div>
        )}
      </div>
    </section>
  );
}

function ChangeSetDetail({
  changeSet,
  versions,
  lockOnApprove,
  lockedElementIds,
  onApprove,
  onReject,
  onToggleElementLock,
  onLockOnApproveChange
}: {
  changeSet: ChangeSet;
  versions: PlanVersion[];
  lockOnApprove: boolean;
  lockedElementIds: string[];
  onApprove: (changeSetId: string, lockChangedElements: boolean) => void;
  onReject: (changeSetId: string) => void;
  onToggleElementLock: (elementId: string) => void;
  onLockOnApproveChange: (value: boolean) => void;
}) {
  const baseLabel = versions.find((version) => version.id === changeSet.baseVersionId)?.label ?? changeSet.baseVersionId;
  const targetLabel = changeSet.targetVersionId
    ? versions.find((version) => version.id === changeSet.targetVersionId)?.label ?? changeSet.targetVersionId
    : "—";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
      <div className="mb-3 space-y-2">
        <div className="text-sm font-medium text-white">{changeSet.summary}</div>
        <div className="text-xs text-muted">
          {baseLabel} → {targetLabel}
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-muted">
          <span>Source: {changeSet.source}</span>
          <span>Created: {new Date(changeSet.createdAt).toLocaleString()}</span>
          {changeSet.reviewedAt ? <span>Reviewed: {new Date(changeSet.reviewedAt).toLocaleString()}</span> : null}
        </div>
      </div>

      {changeSet.status === "draft" ? (
        <div className="mb-3 rounded border border-warning/30 bg-warning/5 p-2">
          <label className="flex items-center gap-2 text-xs text-slate-100">
            <input
              checked={lockOnApprove}
              className="accent-accent"
              type="checkbox"
              onChange={(event) => onLockOnApproveChange(event.target.checked)}
            />
            Lock changed elements after approval
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="flex items-center gap-1 rounded border border-success/40 bg-success/10 px-2 py-1 text-xs text-success hover:border-success"
              type="button"
              onClick={() => onApprove(changeSet.id, lockOnApprove)}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              className="flex items-center gap-1 rounded border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger hover:border-danger"
              type="button"
              onClick={() => onReject(changeSet.id)}
            >
              <X className="h-3.5 w-3.5" />
              Reject & revert
            </button>
          </div>
        </div>
      ) : changeSet.status === "approved" ? (
        <div className="mb-3 flex items-center gap-2 rounded border border-success/30 bg-success/5 p-2 text-xs text-success">
          <ShieldCheck className="h-3.5 w-3.5" />
          Approved change set
        </div>
      ) : changeSet.status === "rejected" ? (
        <div className="mb-3 flex items-center gap-2 rounded border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
          <ShieldAlert className="h-3.5 w-3.5" />
          Rejected and reverted to base version
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded border border-line">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-2 py-2">Change</th>
              <th className="px-2 py-2">Before</th>
              <th className="px-2 py-2">After</th>
              <th className="px-2 py-2 text-right">Lock</th>
            </tr>
          </thead>
          <tbody>
            {changeSet.changes.slice(0, 40).map((change) => {
              const locked = lockedElementIds.includes(change.elementId);

              return (
                <tr className="border-t border-line/80" key={`${change.elementId}-${change.field ?? change.changeType}`}>
                  <td className="px-2 py-2 text-slate-100">{formatElementChange(change)}</td>
                  <td className="px-2 py-2 text-muted">{formatValue(change.before)}</td>
                  <td className="px-2 py-2 text-muted">{formatValue(change.after)}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      className={`rounded border px-1.5 py-0.5 ${
                        locked ? "border-warning/50 text-warning" : "border-line text-muted hover:text-slate-100"
                      }`}
                      type="button"
                      onClick={() => onToggleElementLock(change.elementId)}
                    >
                      <Lock className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {changeSet.changes.length > 40 ? (
          <div className="border-t border-line px-2 py-2 text-[11px] text-muted">
            Showing 40 of {changeSet.changes.length} element changes.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === undefined || value === null) {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
