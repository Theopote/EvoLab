"use client";

import { GitMerge, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { HybridSelectionCanvas } from "@/components/comparison/HybridSelectionCanvas";
import { PlanChangeProposalPanel } from "@/components/copilot/PlanChangeProposalPanel";
import { useCopilotProposalRevision } from "@/components/copilot/useCopilotProposalRevision";
import { requestSchemeHybridize, roomsForHybridPicker, stampHybridVersion } from "@/lib/hybridize-client";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

interface SchemeHybridPanelProps {
  versionA: PlanVersion;
  versionB: PlanVersion;
  levelId?: string;
}

export function SchemeHybridPanel({ versionA, versionB, levelId }: SchemeHybridPanelProps) {
  const [selectedA, setSelectedA] = useState<Set<string>>(new Set());
  const [selectedB, setSelectedB] = useState<Set<string>>(new Set());
  const [priority, setPriority] = useState<"A" | "B">("A");
  const baseVersion = priority === "B" ? versionB : versionA;
  const {
    lockedElementIds,
    pendingProposal,
    prepareProposal,
    applyPendingProposal,
    dismissPendingProposal
  } = useCopilotProposalRevision({ activeVersion: baseVersion });
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [findings, setFindings] = useState<CopilotFinding[]>([]);

  const roomsA = useMemo(() => roomsForHybridPicker(versionA, levelId), [levelId, versionA]);
  const roomsB = useMemo(() => roomsForHybridPicker(versionB, levelId), [levelId, versionB]);
  const overlapIds = useMemo(() => {
    const ids = new Set<string>();
    selectedA.forEach((id) => {
      if (selectedB.has(id)) {
        ids.add(id);
      }
    });
    return ids;
  }, [selectedA, selectedB]);

  const canHybridize = selectedA.size > 0 && selectedB.size > 0;

  function toggleSelection(side: "A" | "B", roomId: string) {
    const setter = side === "A" ? setSelectedA : setSelectedB;
    setter((current) => {
      const next = new Set(current);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  }

  function clearSelections() {
    setSelectedA(new Set());
    setSelectedB(new Set());
    setFindings([]);
    setNotice(null);
    dismissPendingProposal();
  }

  async function previewHybrid() {
    if (!canHybridize || isSending || pendingProposal) {
      return;
    }

    setIsSending(true);
    setNotice(null);
    setFindings([]);

    try {
      const data = await requestSchemeHybridize({
        versionA,
        versionB,
        keptFromA: [...selectedA],
        keptFromB: [...selectedB],
        priority,
        outline: versionA.outline
      });

      const roomNamesA = roomsA.filter((room) => selectedA.has(room.id)).map((room) => room.name);
      const roomNamesB = roomsB.filter((room) => selectedB.has(room.id)).map((room) => room.name);
      const prompt = `Hybridized ${roomNamesA.join(", ")} from ${versionA.label} with ${roomNamesB.join(", ")} from ${versionB.label}`;

      prepareProposal({
        prompt,
        baseVersion,
        proposal: data.proposal,
        findings: data.findings ?? [],
        warning: data.warning
      });
      setFindings(data.findings ?? []);
      setNotice(
        data.geometryValid === false
          ? "Geometry validator reported issues — review operations before applying."
          : data.warning
            ? `Review the hybrid change proposal. ${data.warning}`
            : "Review the hybrid change proposal before applying."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Hybridize request failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="rounded border border-accent/30 bg-accent/5 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <GitMerge className="h-4 w-4 text-accent" />
            Scheme hybrid
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted">
            Lock regions from each scheme, then fill the remaining outline. Overlapping room IDs follow the priority
            below — geometry is validated before accept.
          </p>
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={clearSelections}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {pendingProposal ? (
        <div className="mb-3">
          <PlanChangeProposalPanel
            applyNotice={
              findings.length
                ? findings.map((item) => item.text).join(" ")
                : pendingProposal.warning
            }
            baseVersion={pendingProposal.baseVersion}
            lockedElementIds={lockedElementIds}
            proposal={pendingProposal.proposal}
            onApply={(nextVersion, acceptedOperationIds) => {
              const stamped = stampHybridVersion(nextVersion, versionA, versionB);
              applyPendingProposal(stamped, acceptedOperationIds);
              clearSelections();
              setNotice("Hybrid scheme applied via accepted operations.");
            }}
            onDismiss={() => {
              dismissPendingProposal();
              setNotice("Hybrid proposal dismissed.");
            }}
          />
        </div>
      ) : null}

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-accent">Scheme A · {versionA.label}</h3>
            <SelectedRoomChips rooms={roomsA} selectedIds={selectedA} tone="accent" />
          </div>
          <HybridSelectionCanvas
            accentClass="accent"
            rooms={roomsA}
            selectedRoomIds={selectedA}
            version={versionA}
            onToggleRoom={(roomId) => toggleSelection("A", roomId)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-warning">Scheme B · {versionB.label}</h3>
            <SelectedRoomChips rooms={roomsB} selectedIds={selectedB} tone="warning" />
          </div>
          <HybridSelectionCanvas
            accentClass="warning"
            rooms={roomsB}
            selectedRoomIds={selectedB}
            version={versionB}
            onToggleRoom={(roomId) => toggleSelection("B", roomId)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="text-xs text-muted">Overlap priority when the same room ID is locked on both sides:</div>
        <label className="flex items-center gap-1 text-xs text-slate-100">
          <input
            checked={priority === "A"}
            name="hybrid-priority"
            type="radio"
            onChange={() => setPriority("A")}
          />
          Prefer A
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-100">
          <input
            checked={priority === "B"}
            name="hybrid-priority"
            type="radio"
            onChange={() => setPriority("B")}
          />
          Prefer B
        </label>
        {overlapIds.size > 0 ? (
          <span className="text-[11px] text-warning">{overlapIds.size} overlapping room ID(s)</span>
        ) : null}
        <button
          className="ml-auto flex h-9 items-center gap-2 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canHybridize || isSending || Boolean(pendingProposal)}
          type="button"
          onClick={() => void previewHybrid()}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
          Preview hybrid
        </button>
      </div>

      {!canHybridize ? (
        <p className="mt-2 text-xs text-muted">Select at least one room on each scheme to enable hybridization.</p>
      ) : null}
      {notice ? <p className="mt-2 text-xs text-warning">{notice}</p> : null}
    </section>
  );
}

function SelectedRoomChips({
  rooms,
  selectedIds,
  tone
}: {
  rooms: Array<{ id: string; name: string }>;
  selectedIds: Set<string>;
  tone: "accent" | "warning";
}) {
  const labels = rooms.filter((room) => selectedIds.has(room.id)).map((room) => room.name);

  if (!labels.length) {
    return <span className="text-[10px] text-muted">No rooms locked</span>;
  }

  return (
    <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
      {labels.map((label) => (
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] ${
            tone === "accent" ? "border-accent/40 text-accent" : "border-warning/40 text-warning"
          }`}
          key={label}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
