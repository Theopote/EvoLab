"use client";

import { Eraser, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { PlanChangeProposalPanel } from "@/components/copilot/PlanChangeProposalPanel";
import { useCopilotProposalRevision } from "@/components/copilot/useCopilotProposalRevision";
import type { PlanVersion } from "@/lib/project-types";
import type { RecognizedSketchRoom } from "@/lib/schemas/sketch-interpretation-schema";
import {
  buildProposalFromVersionPreview,
  defaultAcceptedOperationIdsForSketch
} from "@/lib/proposal-from-preview";
import { recognizeSketchInput } from "@/lib/sketch-recognition";
import { useSketchInputStore } from "@/lib/sketch-input-store";
import { useSketchAutoRecognition } from "@/lib/use-sketch-auto-recognition";

interface SketchInputToolbarProps {
  version?: PlanVersion;
}

export function SketchInputToolbar({ version }: SketchInputToolbarProps) {
  const strokes = useSketchInputStore((state) => state.strokes);
  const ghostLoops = useSketchInputStore((state) => state.ghostLoops);
  const recognitionStatus = useSketchInputStore((state) => state.recognitionStatus);
  const clearSketch = useSketchInputStore((state) => state.clearSketch);
  const setSemanticRooms = useSketchInputStore((state) => state.setSemanticRooms);
  const setRecognitionStatus = useSketchInputStore((state) => state.setRecognitionStatus);
  const {
    lockedElementIds,
    pendingProposal,
    prepareProposal,
    applyPendingProposal,
    dismissPendingProposal
  } = useCopilotProposalRevision({ activeVersion: version });
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [recognizedRooms, setRecognizedRooms] = useState<RecognizedSketchRoom[]>([]);
  const [applyNotice, setApplyNotice] = useState<string | undefined>();

  const needsReviewRoomIds = useMemo(
    () => recognizedRooms.filter((entry) => entry.confidence === "needs_review").map((entry) => entry.room.id),
    [recognizedRooms]
  );
  const isRecognizing = isSending || recognitionStatus === "recognizing";

  const defaultAcceptedOperationIds = useMemo(() => {
    if (!pendingProposal) {
      return undefined;
    }

    return defaultAcceptedOperationIdsForSketch(pendingProposal.proposal, needsReviewRoomIds);
  }, [needsReviewRoomIds, pendingProposal]);

  const applyRecognitionResult = useCallback(
    (result: {
      version: PlanVersion;
      recognizedRooms: RecognizedSketchRoom[];
      warnings: string[];
      auto: boolean;
    }) => {
      if (!version) {
        return;
      }

      const prompt = `Sketch input recognized ${result.recognizedRooms.length} room(s).`;
      const proposal = buildProposalFromVersionPreview(version, result.version, prompt, {
        focusRoomIds: result.recognizedRooms.map((entry) => entry.room.id)
      });

      if (!proposal?.operations.length) {
        setRecognitionStatus("error");
        setNotice("Sketch recognition did not produce reviewable operations.");
        return;
      }

      setSemanticRooms(result.recognizedRooms);
      setRecognitionStatus("ready");
      setRecognizedRooms(result.recognizedRooms);
      setApplyNotice(result.warnings.join(" ") || undefined);
      prepareProposal({
        prompt,
        baseVersion: version,
        proposal,
        findings: [],
        warning: result.warnings.join(" ") || undefined,
        allowedRoomIds: result.recognizedRooms.map((entry) => entry.room.id)
      });
      setNotice(
        result.auto
          ? `Auto-recognized ${result.recognizedRooms.length} room(s). Review operations before applying.`
          : "Review recognized room operations before applying."
      );
    },
    [prepareProposal, setRecognitionStatus, setSemanticRooms, version]
  );

  useSketchAutoRecognition({
    version,
    enabled: Boolean(version),
    onRecognized: applyRecognitionResult,
    onRecognizingChange: (recognizing) => {
      if (recognizing) {
        setRecognitionStatus("recognizing");
      }
    },
    onError: (message) => {
      setRecognitionStatus("error");
      setNotice(message);
    }
  });

  async function submitSketchRecognition() {
    if (!version || ghostLoops.length === 0 || isRecognizing) {
      return;
    }

    setIsSending(true);
    setNotice(null);
    setRecognitionStatus("recognizing");

    try {
      const result = await recognizeSketchInput({
        version,
        strokes,
        ghostLoops
      });
      applyRecognitionResult({ ...result, auto: false });
    } catch (error) {
      setRecognitionStatus("error");
      setNotice(error instanceof Error ? error.message : "Sketch recognition failed.");
    } finally {
      setIsSending(false);
    }
  }

  const statusHint =
    recognitionStatus === "pending"
      ? "Pause 1.5s to auto-label rooms"
      : recognitionStatus === "recognizing"
        ? "Recognizing paused sketch..."
        : recognitionStatus === "ready" && !pendingProposal
          ? "Rooms labeled — open preview to apply"
          : null;

  return (
    <div className="mb-3 rounded border border-accent/35 bg-accent/8 p-3">
      {pendingProposal && version ? (
        <div className="mb-3">
          {needsReviewRoomIds.length > 0 ? (
            <p className="mb-2 text-xs text-warning">
              {needsReviewRoomIds.length} room(s) marked needs_review start unchecked. Confirm each operation before
              applying.
            </p>
          ) : null}
          <PlanChangeProposalPanel
            allowedRoomIds={pendingProposal.allowedRoomIds}
            applyNotice={applyNotice}
            baseVersion={pendingProposal.baseVersion}
            defaultAcceptedOperationIds={defaultAcceptedOperationIds}
            lockedElementIds={lockedElementIds}
            proposal={pendingProposal.proposal}
            onApply={(nextVersion, acceptedOperationIds) => {
              applyPendingProposal(nextVersion, acceptedOperationIds);
              clearSketch();
              setRecognizedRooms([]);
              setApplyNotice(undefined);
              setNotice("Sketch rooms applied via accepted operations.");
            }}
            onDismiss={() => {
              dismissPendingProposal();
              setRecognizedRooms([]);
              setApplyNotice(undefined);
              setRecognitionStatus(ghostLoops.length > 0 ? "ready" : "idle");
              setNotice("Sketch proposal dismissed. Labels remain on ghost outlines.");
            }}
          />
        </div>
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          <Pencil className="h-3.5 w-3.5" />
          Sketch Input
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={clearSketch}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear sketch
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">
        Draw closed room loops on the meter grid. Ghost outlines appear immediately; AI labels arrive after a 1.5s pause.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="h-9 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRecognizing || ghostLoops.length === 0 || !version}
          type="button"
          onClick={() => void submitSketchRecognition()}
        >
          {isRecognizing
            ? "Recognizing..."
            : pendingProposal
              ? "Re-run recognition"
              : `Recognize now (${ghostLoops.length} loop${ghostLoops.length === 1 ? "" : "s"})`}
        </button>
        <span className="text-[11px] text-muted">
          {strokes.length} stroke{strokes.length === 1 ? "" : "s"} / scale from active plan grid
        </span>
      </div>
      {statusHint ? <div className="mt-2 text-xs text-muted">{statusHint}</div> : null}
      {notice ? <div className="mt-2 text-xs text-accent">{notice}</div> : null}
    </div>
  );
}
