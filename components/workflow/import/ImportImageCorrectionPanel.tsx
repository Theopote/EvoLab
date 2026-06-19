"use client";

import { useState } from "react";
import { Loader2, RotateCcw, RotateCw } from "lucide-react";
import type { CopilotPinnedFile } from "@/lib/copilot-upload";
import { rotateImageDataUrl } from "@/lib/import-image-correction";

interface ImportImageCorrectionPanelProps {
  file: CopilotPinnedFile;
  onBack: () => void;
  onContinue: (file: CopilotPinnedFile) => void;
}

export function ImportImageCorrectionPanel({ file, onBack, onContinue }: ImportImageCorrectionPanelProps) {
  const [draftFile, setDraftFile] = useState(file);
  const [originalFile] = useState(file);
  const [isRotating, setIsRotating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function rotate(degrees: 90 | -90 | 180) {
    setIsRotating(true);
    setError(undefined);

    try {
      const rotated = await rotateImageDataUrl(draftFile.previewUrl, degrees);

      setDraftFile({
        ...draftFile,
        base64: rotated.base64,
        previewUrl: rotated.dataUrl,
        mediaType: rotated.mediaType,
        byteLength: rotated.byteLength
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to rotate image.");
    } finally {
      setIsRotating(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Correct scan orientation</h2>
          <p className="mt-1 text-xs text-muted">
            Rotate the drawing before recognition. Perspective deskew will come in a later pass.
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

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="grid min-h-[360px] place-items-center overflow-hidden rounded border border-line bg-[#081018] p-4">
          <img
            alt={draftFile.fileName}
            className="max-h-[520px] max-w-full object-contain"
            src={draftFile.previewUrl}
          />
        </section>

        <aside className="space-y-3">
          <section className="rounded border border-line bg-panel/90 p-4">
            <h3 className="text-sm font-semibold text-white">Rotation</h3>
            <div className="mt-3 grid gap-2">
              <button
                className="flex items-center justify-center gap-2 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                disabled={isRotating}
                type="button"
                onClick={() => void rotate(-90)}
              >
                <RotateCcw className="h-4 w-4 text-accent" />
                Rotate left 90°
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                disabled={isRotating}
                type="button"
                onClick={() => void rotate(90)}
              >
                <RotateCw className="h-4 w-4 text-accent" />
                Rotate right 90°
              </button>
              <button
                className="rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                disabled={isRotating}
                type="button"
                onClick={() => void rotate(180)}
              >
                Flip 180°
              </button>
              <button
                className="rounded border border-line px-3 py-2 text-xs text-muted transition hover:text-slate-100 disabled:opacity-50"
                disabled={isRotating}
                type="button"
                onClick={() => setDraftFile(originalFile)}
              >
                Reset to original
              </button>
            </div>
            {isRotating ? (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Applying rotation…
              </p>
            ) : null}
            {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
          </section>

          <button
            className="w-full rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-50"
            disabled={isRotating}
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
