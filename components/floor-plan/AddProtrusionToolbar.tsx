"use client";

import { Eraser, SquarePlus } from "lucide-react";
import { useState } from "react";
import { PlanChangeProposalPanel } from "@/components/copilot/PlanChangeProposalPanel";
import { useCopilotProposalRevision } from "@/components/copilot/useCopilotProposalRevision";
import type { CopilotFinding } from "@/lib/project-types";
import type { PlanVersion } from "@/lib/project-types";
import { useLocalFormEditStore } from "@/lib/local-form-edit-store";
import { buildProposalFromVersionPreview } from "@/lib/proposal-from-preview";
import { useEvoProject } from "@/lib/project-store";

interface AddProtrusionToolbarProps {
  version?: PlanVersion;
  levelId?: string;
}

export function AddProtrusionToolbar({ version, levelId }: AddProtrusionToolbarProps) {
  const scoringConfig = useEvoProject((state) => state.project.domain.scoringConfig);
  const protrusionPlacement = useLocalFormEditStore((state) => state.protrusionPlacement);
  const protrusionPrompt = useLocalFormEditStore((state) => state.protrusionPrompt);
  const protrusionWidthM = useLocalFormEditStore((state) => state.protrusionWidthM);
  const setProtrusionPrompt = useLocalFormEditStore((state) => state.setProtrusionPrompt);
  const setProtrusionPlacement = useLocalFormEditStore((state) => state.setProtrusionPlacement);
  const setProtrusionWidthM = useLocalFormEditStore((state) => state.setProtrusionWidthM);
  const clearProtrusionPlacement = useLocalFormEditStore((state) => state.clearProtrusionPlacement);
  const {
    lockedElementIds,
    pendingProposal,
    prepareProposal,
    applyPendingProposal,
    dismissPendingProposal
  } = useCopilotProposalRevision({ activeVersion: version });
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [applyNotice, setApplyNotice] = useState<string | undefined>();

  const level = version?.levels.find((item) => item.id === levelId) ?? version?.levels[0];
  const walls = level?.walls ?? [];
  const selectedWall = protrusionPlacement ? walls.find((wall) => wall.id === protrusionPlacement.wallId) : undefined;
  const hostRoomId = selectedWall?.roomIds.find((roomId) => {
    const room = version?.rooms.find((item) => item.id === roomId);
    return room && room.type !== "corridor";
  });

  async function submitProtrusion() {
    if (!version || !selectedWall || !hostRoomId || !protrusionPrompt.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/add-protrusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: version,
          roomId: hostRoomId,
          wall: selectedWall,
          positionOnEdge: protrusionPlacement?.positionOnEdge ?? 0.5,
          widthM: protrusionWidthM,
          userRequest: protrusionPrompt.trim(),
          levelId,
          scoringConfig
        })
      });

      const data = (await response.json()) as {
        version?: PlanVersion;
        findings?: CopilotFinding[];
        warning?: string;
        gfaBasis?: string;
        error?: string;
      };

      if (!response.ok || !data.version) {
        throw new Error(data.error ?? `add-protrusion failed with ${response.status}`);
      }

      const proposal = buildProposalFromVersionPreview(version, data.version, protrusionPrompt.trim(), {
        focusRoomIds: [hostRoomId]
      });

      if (!proposal?.operations.length) {
        throw new Error("Protrusion preview did not produce reviewable operations.");
      }

      prepareProposal({
        prompt: protrusionPrompt.trim(),
        baseVersion: version,
        proposal,
        findings: data.findings ?? [],
        warning: data.warning,
        allowedRoomIds: [hostRoomId]
      });

      setApplyNotice([data.warning, data.gfaBasis].filter(Boolean).join(" "));
      setNotice("Review the protrusion operation before applying.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Protrusion preview failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mb-3 rounded border border-cyan-500/35 bg-cyan-500/10 p-3">
      {pendingProposal && version ? (
        <div className="mb-3">
          <PlanChangeProposalPanel
            allowedRoomIds={[hostRoomId].filter(Boolean) as string[]}
            applyNotice={applyNotice}
            baseVersion={pendingProposal.baseVersion}
            lockedElementIds={lockedElementIds}
            proposal={pendingProposal.proposal}
            onApply={(nextVersion, acceptedOperationIds) => {
              applyPendingProposal(nextVersion, acceptedOperationIds);
              clearProtrusionPlacement();
              setApplyNotice(undefined);
              setNotice("Protrusion applied via accepted operations.");
            }}
            onDismiss={() => {
              dismissPendingProposal();
              setApplyNotice(undefined);
              setNotice("Protrusion proposal dismissed.");
            }}
          />
        </div>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
          <SquarePlus className="h-3.5 w-3.5" />
          Add Protrusion
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={clearProtrusionPlacement}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear placement
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">
        Click an exterior wall to place the protrusion center, set width, then describe the bump-out. GFA exemption uses
        project-configured thresholds with a verify-local-regulations notice.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted">
          Width (m)
          <input
            className="ml-2 w-20 rounded border border-line bg-[#0b1118] px-2 py-1 text-sm text-slate-100"
            max={6}
            min={0.6}
            step={0.1}
            type="number"
            value={protrusionWidthM}
            onChange={(event) => {
              const nextWidth = Number(event.target.value);
              setProtrusionWidthM(nextWidth);
              if (protrusionPlacement) {
                setProtrusionPlacement({ ...protrusionPlacement, widthM: nextWidth });
              }
            }}
          />
        </label>
        {selectedWall ? (
          <span className="text-xs text-muted">
            Wall {selectedWall.id} · position {(protrusionPlacement?.positionOnEdge ?? 0.5).toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-warning">Click a wall on the canvas to place the protrusion.</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 min-w-[240px] flex-1 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
          disabled={isSending || Boolean(pendingProposal)}
          placeholder='e.g. add a shallow bay window with 0.45m depth'
          value={protrusionPrompt}
          onChange={(event) => setProtrusionPrompt(event.target.value)}
        />
        <button
          className="h-9 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            isSending || Boolean(pendingProposal) || !selectedWall || !protrusionPrompt.trim() || !version
          }
          type="button"
          onClick={() => void submitProtrusion()}
        >
          {isSending ? "Generating..." : "Preview protrusion"}
        </button>
      </div>
      {notice ? <div className="mt-2 text-xs text-warning">{notice}</div> : null}
    </div>
  );
}
