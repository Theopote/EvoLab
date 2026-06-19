"use client";

import { Eraser, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { DiffPreviewOverlay } from "@/components/floor-plan/DiffPreviewOverlay";
import { captureSketchImage } from "@/lib/sketch-capture";
import type { PlanVersion } from "@/lib/project-types";
import type { RecognizedSketchRoom } from "@/lib/schemas/sketch-interpretation-schema";
import { useSketchInputStore } from "@/lib/sketch-input-store";

interface SketchInputToolbarProps {
  version?: PlanVersion;
  onSketchRevision: (version: PlanVersion, prompt: string) => void;
}

export function SketchInputToolbar({ version, onSketchRevision }: SketchInputToolbarProps) {
  const strokes = useSketchInputStore((state) => state.strokes);
  const ghostLoops = useSketchInputStore((state) => state.ghostLoops);
  const clearSketch = useSketchInputStore((state) => state.clearSketch);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{
    version: PlanVersion;
    recognizedRooms: RecognizedSketchRoom[];
    warning?: string;
  } | null>(null);
  const [confirmedReviewIds, setConfirmedReviewIds] = useState<string[]>([]);

  const needsReviewRoomIds = useMemo(
    () =>
      pendingPreview?.recognizedRooms
        .filter((entry) => entry.confidence === "needs_review")
        .map((entry) => entry.room.id) ?? [],
    [pendingPreview]
  );

  const unconfirmedReviewIds = needsReviewRoomIds.filter((roomId) => !confirmedReviewIds.includes(roomId));

  async function submitSketchRecognition() {
    if (!version || ghostLoops.length === 0 || isSending) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const sketchImageBase64 = await captureSketchImage(version, strokes, ghostLoops);
      const response = await fetch("/api/interpret-sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: version,
          closedLoops: ghostLoops,
          sketchImageBase64,
          appendRooms: true
        })
      });

      if (!response.ok) {
        throw new Error(`interpret-sketch failed with ${response.status}`);
      }

      const data = (await response.json()) as {
        version?: PlanVersion;
        recognizedRooms?: RecognizedSketchRoom[];
        warnings?: string[];
        fallback?: boolean;
      };

      if (!data.version?.rooms) {
        throw new Error("interpret-sketch did not return a complete PlanVersion.");
      }

      setPendingPreview({
        version: data.version,
        recognizedRooms: data.recognizedRooms ?? [],
        warning: data.warnings?.join(" ")
      });
      setConfirmedReviewIds([]);
      setNotice("Review recognized rooms before applying the sketch result.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sketch recognition failed.");
    } finally {
      setIsSending(false);
    }
  }

  function acceptPreview() {
    if (!pendingPreview) {
      return;
    }

    if (unconfirmedReviewIds.length > 0) {
      setNotice("Confirm every orange room before applying the sketch result.");
      return;
    }

    onSketchRevision(
      pendingPreview.version,
      `Sketch input recognized ${pendingPreview.recognizedRooms.length} room(s).`
    );
    clearSketch();
    setPendingPreview(null);
    setConfirmedReviewIds([]);
    setNotice(
      pendingPreview.warning
        ? `Sketch applied with fallback: ${pendingPreview.warning}`
        : "Sketch rooms applied to the active plan."
    );
  }

  function rejectPreview() {
    setPendingPreview(null);
    setConfirmedReviewIds([]);
    setNotice("Sketch preview rejected.");
  }

  function toggleReviewConfirmation(roomId: string) {
    setConfirmedReviewIds((current) =>
      current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId]
    );
  }

  return (
    <div className="mb-3 rounded border border-accent/35 bg-accent/8 p-3">
      {pendingPreview && version ? (
        <DiffPreviewOverlay
          baseVersion={version}
          highlightRoomIds={needsReviewRoomIds}
          needsReviewRoomIds={needsReviewRoomIds}
          notice={pendingPreview.warning}
          previewVersion={pendingPreview.version}
          sketchUnderlay={{ strokes, ghostLoops: ghostLoops.map((loop) => loop.polygon) }}
          title="Sketch recognition preview"
          onAccept={acceptPreview}
          onReject={rejectPreview}
        />
      ) : null}
      {pendingPreview && unconfirmedReviewIds.length > 0 ? (
        <div className="mb-3 rounded border border-warning/35 bg-warning/10 p-2">
          <p className="mb-2 text-xs text-warning">
            {unconfirmedReviewIds.length} room(s) need manual confirmation before apply.
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingPreview.recognizedRooms
              .filter((entry) => entry.confidence === "needs_review")
              .map((entry) => {
                const confirmed = confirmedReviewIds.includes(entry.room.id);

                return (
                  <button
                    key={entry.room.id}
                    className={`rounded border px-2 py-1 text-[11px] ${
                      confirmed
                        ? "border-accent/50 text-accent"
                        : "border-warning/50 text-warning hover:border-accent/50 hover:text-accent"
                    }`}
                    type="button"
                    onClick={() => toggleReviewConfirmation(entry.room.id)}
                  >
                    {confirmed ? "Confirmed" : "Confirm"} {entry.room.name}
                  </button>
                );
              })}
          </div>
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
        Draw closed room loops on the meter grid. Ghost outlines appear when a stroke closes; recognize when ready.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="h-9 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSending || Boolean(pendingPreview) || ghostLoops.length === 0 || !version}
          type="button"
          onClick={() => void submitSketchRecognition()}
        >
          {isSending ? "Recognizing..." : `Recognize sketch (${ghostLoops.length} loop${ghostLoops.length === 1 ? "" : "s"})`}
        </button>
        <span className="text-[11px] text-muted">
          {strokes.length} stroke{strokes.length === 1 ? "" : "s"} / scale from active plan grid
        </span>
      </div>
      {notice ? <div className="mt-2 text-xs text-accent">{notice}</div> : null}
    </div>
  );
}
