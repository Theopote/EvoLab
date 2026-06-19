"use client";

import { Eraser, Spline } from "lucide-react";
import { useMemo, useState } from "react";
import { PlanChangeProposalPanel } from "@/components/copilot/PlanChangeProposalPanel";
import { useCopilotProposalRevision } from "@/components/copilot/useCopilotProposalRevision";
import type { CopilotFinding } from "@/lib/project-types";
import type { PlanVersion } from "@/lib/project-types";
import { useLocalFormEditStore } from "@/lib/local-form-edit-store";
import { buildProposalFromVersionPreview } from "@/lib/proposal-from-preview";
import { spanIncludesSharedEdge } from "@/lib/reshape-boundary";
import { deriveWallGraph } from "@/lib/wall-graph";

interface ReshapeBoundaryToolbarProps {
  version?: PlanVersion;
  roomId?: string;
  levelId?: string;
}

export function ReshapeBoundaryToolbar({ version, roomId, levelId }: ReshapeBoundaryToolbarProps) {
  const boundarySpan = useLocalFormEditStore((state) => state.boundarySpan);
  const reshapePrompt = useLocalFormEditStore((state) => state.reshapePrompt);
  const setReshapePrompt = useLocalFormEditStore((state) => state.setReshapePrompt);
  const clearBoundarySpan = useLocalFormEditStore((state) => state.clearBoundarySpan);
  const {
    lockedElementIds,
    pendingProposal,
    prepareProposal,
    applyPendingProposal,
    dismissPendingProposal
  } = useCopilotProposalRevision({ activeVersion: version });
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [openingPolicy, setOpeningPolicy] = useState<"preserve" | "remove">("preserve");
  const [applyNotice, setApplyNotice] = useState<string | undefined>();

  const sharedEdgeBlocked = useMemo(() => {
    if (!version || !boundarySpan || !roomId) {
      return false;
    }

    const room = version.rooms.find((item) => item.id === roomId);
    if (!room) {
      return false;
    }

    const graph = deriveWallGraph(version.rooms);
    return spanIncludesSharedEdge(boundarySpan, room.polygon, graph);
  }, [boundarySpan, roomId, version]);

  async function submitReshape() {
    if (!version || !boundarySpan || !reshapePrompt.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/reshape-boundary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: version,
          span: boundarySpan,
          userRequest: reshapePrompt.trim(),
          openingPolicy,
          levelId
        })
      });

      const data = (await response.json()) as {
        version?: PlanVersion;
        warning?: string;
        openingRepairs?: string[];
        affectedOpeningIds?: string[];
        findings?: CopilotFinding[];
        error?: string;
      };

      if (!response.ok || !data.version) {
        throw new Error(data.error ?? `reshape-boundary failed with ${response.status}`);
      }

      const proposal = buildProposalFromVersionPreview(version, data.version, reshapePrompt.trim());

      if (!proposal?.operations.length) {
        throw new Error("Boundary reshape did not produce reviewable operations.");
      }

      prepareProposal({
        prompt: reshapePrompt.trim(),
        baseVersion: version,
        proposal,
        findings: data.findings ?? [],
        warning: data.warning
      });

      setApplyNotice(
        [
          data.warning,
          data.affectedOpeningIds?.length
            ? `Affected openings: ${data.affectedOpeningIds.join(", ")}`
            : undefined,
          data.openingRepairs?.length ? `Opening updates: ${data.openingRepairs.join(" ")}` : undefined
        ]
          .filter(Boolean)
          .join(" ")
      );
      setNotice("Review each boundary reshape operation before applying.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Boundary reshape failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mb-3 rounded border border-sky-500/35 bg-sky-500/10 p-3">
      {pendingProposal && version ? (
        <div className="mb-3">
          <PlanChangeProposalPanel
            applyNotice={applyNotice}
            baseVersion={pendingProposal.baseVersion}
            lockedElementIds={lockedElementIds}
            proposal={pendingProposal.proposal}
            onApply={(nextVersion, acceptedOperationIds) => {
              applyPendingProposal(nextVersion, acceptedOperationIds);
              clearBoundarySpan();
              setApplyNotice(undefined);
              setNotice("Boundary reshape applied via accepted operations.");
            }}
            onDismiss={() => {
              dismissPendingProposal();
              setApplyNotice(undefined);
              setNotice("Boundary reshape proposal dismissed.");
            }}
          />
        </div>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-sky-300">
          <Spline className="h-3.5 w-3.5" />
          Boundary Reshape
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={clearBoundarySpan}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear span
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">
        Click two boundary vertices on the selected room. Hold Shift for the long arc. Locked anchors keep the new curve
        flush with the existing wall.
      </p>
      {sharedEdgeBlocked ? (
        <p className="mb-2 text-xs text-warning">
          This span crosses a shared interior wall. Pick an exterior or room-exclusive edge before reshaping.
        </p>
      ) : null}
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        <label className="inline-flex items-center gap-2">
          <input
            checked={openingPolicy === "preserve"}
            name="opening-policy"
            type="radio"
            onChange={() => setOpeningPolicy("preserve")}
          />
          Preserve openings
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            checked={openingPolicy === "remove"}
            name="opening-policy"
            type="radio"
            onChange={() => setOpeningPolicy("remove")}
          />
          Remove affected openings
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 min-w-[240px] flex-1 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
          disabled={isSending || Boolean(pendingProposal)}
          placeholder='e.g. round this corner into a smooth arc'
          value={reshapePrompt}
          onChange={(event) => setReshapePrompt(event.target.value)}
        />
        <button
          className="h-9 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            isSending ||
            Boolean(pendingProposal) ||
            !boundarySpan ||
            !reshapePrompt.trim() ||
            !version ||
            sharedEdgeBlocked
          }
          type="button"
          onClick={() => void submitReshape()}
        >
          {isSending ? "Generating..." : "Preview reshape"}
        </button>
      </div>
      {notice ? <div className="mt-2 text-xs text-warning">{notice}</div> : null}
    </div>
  );
}
