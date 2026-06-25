"use client";

import { useState } from "react";
import { Loader2, MoveDiagonal2, RotateCcw, RotateCw, ScanSearch } from "lucide-react";
import {
  ImportPerspectiveEditor,
  createDefaultPerspectiveQuad
} from "@/components/workflow/import/ImportPerspectiveEditor";
import type { CopilotPinnedFile } from "@/lib/copilot-upload";
import { detectSheetCornersClient } from "@/lib/import-corner-detection-client";
import { rotateImageDataUrl } from "@/lib/import-image-correction";
import { isDefaultPerspectiveQuad, type PerspectiveQuad } from "@/lib/import-image-utils";
import { applyPerspectiveCorrection } from "@/lib/import-perspective-correction";

type CorrectionMode = "rotate" | "perspective";

interface ImportImageCorrectionPanelProps {
  file: CopilotPinnedFile;
  onBack: () => void;
  onContinue: (file: CopilotPinnedFile) => void;
}

export function ImportImageCorrectionPanel({ file, onBack, onContinue }: ImportImageCorrectionPanelProps) {
  const [draftFile, setDraftFile] = useState(file);
  const [originalFile] = useState(file);
  const [mode, setMode] = useState<CorrectionMode>("perspective");
  const [perspectiveQuad, setPerspectiveQuad] = useState<PerspectiveQuad>(createDefaultPerspectiveQuad);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDetectingCorners, setIsDetectingCorners] = useState(false);
  const [detectNotice, setDetectNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const perspectiveChanged = !isDefaultPerspectiveQuad(perspectiveQuad);

  async function rotate(degrees: 90 | -90 | 180) {
    setIsProcessing(true);
    setError(undefined);

    try {
      const rotated = await rotateImageDataUrl(draftFile.previewUrl, degrees);

      setDraftFile({
        ...draftFile,
        base64: rotated.base64,
        previewUrl: rotated.dataUrl,
        mediaType: rotated.mediaType
      });
      setPerspectiveQuad(createDefaultPerspectiveQuad());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to rotate image.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function autoDetectCorners() {
    if (!draftFile.mediaType) {
      setError("Only raster image uploads support auto corner detection.");
      return;
    }

    setIsDetectingCorners(true);
    setError(undefined);
    setDetectNotice(undefined);

    try {
      const result = await detectSheetCornersClient({
        imageBase64: draftFile.base64,
        mediaType: draftFile.mediaType,
        fileName: draftFile.fileName
      });

      setPerspectiveQuad(result.quad);
      setDetectNotice(
        result.fallback
          ? `Mock corners applied (${Math.round(result.confidence * 100)}% confidence). ${result.warnings.join(" ")}`
          : `Corners detected at ${Math.round(result.confidence * 100)}% confidence.${
              result.warnings.length ? ` ${result.warnings.join(" ")}` : ""
            }`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to detect sheet corners.");
    } finally {
      setIsDetectingCorners(false);
    }
  }

  async function applyPerspective() {
    setIsProcessing(true);
    setError(undefined);

    try {
      const corrected = await applyPerspectiveCorrection(draftFile.previewUrl, perspectiveQuad);

      setDraftFile({
        ...draftFile,
        base64: corrected.base64,
        previewUrl: corrected.dataUrl,
        mediaType: corrected.mediaType
      });
      setPerspectiveQuad(createDefaultPerspectiveQuad());
      setDetectNotice(undefined);
      setMode("rotate");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to apply perspective correction.");
    } finally {
      setIsProcessing(false);
    }
  }

  function resetDraft() {
    setDraftFile(originalFile);
    setPerspectiveQuad(createDefaultPerspectiveQuad());
    setDetectNotice(undefined);
    setError(undefined);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Correct scan geometry</h2>
          <p className="mt-1 text-xs text-muted">
            Drag the four corners onto the drawing edges, apply perspective correction, then rotate if needed.
          </p>
        </div>
        <button
          className="rounded border border-line px-3 py-1.5 text-xs text-muted transition hover:text-slate-100"
          type="button"
          onClick={onBack}
        >
          Back
        </button>
      </div>

      <div className="flex gap-2">
        <ModeTab active={mode === "perspective"} label="Perspective" onClick={() => setMode("perspective")} />
        <ModeTab active={mode === "rotate"} label="Rotate" onClick={() => setMode("rotate")} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="grid min-h-[360px] place-items-center overflow-hidden rounded border border-line bg-[#081018] p-4">
          {mode === "perspective" ? (
            <ImportPerspectiveEditor
              imageUrl={draftFile.previewUrl}
              quad={perspectiveQuad}
              onQuadChange={setPerspectiveQuad}
            />
          ) : (
            <img
              alt={draftFile.fileName}
              className="max-h-[520px] max-w-full object-contain"
              src={draftFile.previewUrl}
            />
          )}
        </section>

        <aside className="space-y-3">
          {mode === "perspective" ? (
            <section className="rounded border border-line bg-panel/90 p-4">
              <h3 className="text-sm font-semibold text-white">Four-point perspective</h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Place TL / TR / BR / BL on the photographed sheet corners. EvoLab will flatten the image into a
                rectified drawing before recognition.
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  className="flex items-center justify-center gap-2 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                  disabled={isProcessing || isDetectingCorners}
                  type="button"
                  onClick={() => void autoDetectCorners()}
                >
                  {isDetectingCorners ? (
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  ) : (
                    <ScanSearch className="h-4 w-4 text-accent" />
                  )}
                  Auto-detect corners
                </button>
                <button
                  className="flex items-center justify-center gap-2 rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
                  disabled={isProcessing || isDetectingCorners || !perspectiveChanged}
                  type="button"
                  onClick={() => void applyPerspective()}
                >
                  <MoveDiagonal2 className="h-4 w-4" />
                  Apply perspective flatten
                </button>
                <button
                  className="rounded border border-line px-3 py-2 text-xs text-muted transition hover:text-slate-100 disabled:opacity-50"
                  disabled={isProcessing || isDetectingCorners || !perspectiveChanged}
                  type="button"
                  onClick={() => setPerspectiveQuad(createDefaultPerspectiveQuad())}
                >
                  Reset corner handles
                </button>
              </div>
              {detectNotice ? <p className="mt-3 text-xs text-accent">{detectNotice}</p> : null}
            </section>
          ) : (
            <section className="rounded border border-line bg-panel/90 p-4">
              <h3 className="text-sm font-semibold text-white">Rotation</h3>
              <div className="mt-3 grid gap-2">
                <button
                  className="flex items-center justify-center gap-2 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                  disabled={isProcessing || isDetectingCorners}
                  type="button"
                  onClick={() => void rotate(-90)}
                >
                  <RotateCcw className="h-4 w-4 text-accent" />
                  Rotate left 90°
                </button>
                <button
                  className="flex items-center justify-center gap-2 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                  disabled={isProcessing || isDetectingCorners}
                  type="button"
                  onClick={() => void rotate(90)}
                >
                  <RotateCw className="h-4 w-4 text-accent" />
                  Rotate right 90°
                </button>
                <button
                  className="rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                  disabled={isProcessing || isDetectingCorners}
                  type="button"
                  onClick={() => void rotate(180)}
                >
                  Flip 180°
                </button>
              </div>
            </section>
          )}

          <section className="rounded border border-line bg-panel/90 p-4">
            <button
              className="w-full rounded border border-line px-3 py-2 text-xs text-muted transition hover:text-slate-100 disabled:opacity-50"
              disabled={isProcessing || isDetectingCorners}
              type="button"
              onClick={resetDraft}
            >
              Reset to original upload
            </button>
          </section>

          {isProcessing || isDetectingCorners ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isDetectingCorners ? "Detecting sheet corners…" : "Applying correction…"}
            </p>
          ) : null}
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}

          <button
            className="w-full rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
            disabled={isProcessing || isDetectingCorners}
            type="button"
            onClick={() => onContinue(draftFile)}
          >
            Continue to recognize
          </button>
        </aside>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded border px-3 py-1.5 text-xs transition ${
        active ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:text-slate-100"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
