"use client";

import { Eraser, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { PlanChangeProposalPanel } from "@/components/copilot/PlanChangeProposalPanel";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";
import { captureInpaintImages } from "@/lib/inpaint-capture";
import { useInpaintMaskStore } from "@/lib/inpaint-mask-store";
import { useEvoProject } from "@/lib/project-store";
import type { PlanVersion } from "@/lib/project-types";
import { bboxFromStrokes, roomsInSelection } from "@/lib/region-lock";
import { useShallow } from "zustand/react/shallow";

interface InpaintToolbarProps {
  version?: PlanVersion;
  onInpaintRevision: (version: PlanVersion, prompt: string) => void;
}

export function InpaintToolbar({ version, onInpaintRevision }: InpaintToolbarProps) {
  const strokes = useInpaintMaskStore((state) => state.strokes);
  const prompt = useInpaintMaskStore((state) => state.prompt);
  const setPrompt = useInpaintMaskStore((state) => state.setPrompt);
  const clearMask = useInpaintMaskStore((state) => state.clearMask);
  const { lockedElementIds } = useEvoProject(
    useShallow((state) => ({
      lockedElementIds: state.project.domain.lockedElementIds
    }))
  );
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<ModifyPlanResponse | null>(null);

  const allowedRoomIds = useMemo(() => {
    if (!version) {
      return [];
    }

    const bbox = bboxFromStrokes(strokes);
    return bbox ? [...roomsInSelection(version.rooms, bbox)] : version.rooms.map((room) => room.id);
  }, [strokes, version]);

  async function submitInpaint() {
    if (!version || strokes.length === 0 || !prompt.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const { baseImage, maskImage } = await captureInpaintImages(version, strokes);
      const response = await fetch("/api/inpaint-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: version,
          userRequest: prompt.trim(),
          baseImage,
          maskImage,
          allowedRoomIds,
          lockedElementIds
        })
      });

      if (!response.ok) {
        throw new Error(`inpaint-plan failed with ${response.status}`);
      }

      const data = (await response.json()) as ModifyPlanResponse;

      if (!data.version?.rooms || !data.proposal?.operations?.length) {
        throw new Error("inpaint-plan did not return a change proposal.");
      }

      setPendingProposal(data);
      setNotice(
        data.warning
          ? `Review the localized change proposal before applying. ${data.warning}`
          : "Review each operation in the masked region before applying."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Inpaint request failed.");
    } finally {
      setIsSending(false);
    }
  }

  function applyProposal(nextVersion: PlanVersion) {
    if (!pendingProposal) {
      return;
    }

    onInpaintRevision(nextVersion, prompt.trim());
    clearMask();
    setPendingProposal(null);
    setNotice(
      pendingProposal.warning
        ? `Inpaint applied with note: ${pendingProposal.warning}`
        : "Masked region updated via accepted operations."
    );
  }

  function dismissProposal() {
    setPendingProposal(null);
    setNotice("Inpaint proposal dismissed.");
  }

  return (
    <div className="mb-3 rounded border border-warning/35 bg-warning/10 p-3">
      {pendingProposal && version ? (
        <div className="mb-3">
          <PlanChangeProposalPanel
            allowedRoomIds={allowedRoomIds}
            baseVersion={version}
            lockedElementIds={lockedElementIds}
            proposal={pendingProposal.proposal}
            onApply={(nextVersion) => applyProposal(nextVersion)}
            onDismiss={dismissProposal}
          />
        </div>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-warning">
          <Sparkles className="h-3.5 w-3.5" />
          AI Inpaint Brush
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={clearMask}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear mask
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">Paint the region to edit, then describe the localized design change.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 min-w-[240px] flex-1 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
          disabled={isSending || Boolean(pendingProposal)}
          placeholder="e.g. widen this corridor and add a nurse station alcove"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          className="h-9 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSending || Boolean(pendingProposal) || strokes.length === 0 || !prompt.trim() || !version}
          type="button"
          onClick={() => void submitInpaint()}
        >
          {isSending ? "Preparing..." : `Preview inpaint (${strokes.length})`}
        </button>
      </div>
      {notice ? <div className="mt-2 text-xs text-warning">{notice}</div> : null}
    </div>
  );
}
