"use client";

import { Eraser, Sparkles } from "lucide-react";
import { useState } from "react";
import type { PlanVersion } from "@/lib/project-types";
import { captureInpaintImages } from "@/lib/inpaint-capture";
import { useInpaintMaskStore } from "@/lib/inpaint-mask-store";

interface InpaintToolbarProps {
  version?: PlanVersion;
  onInpaintRevision: (version: PlanVersion, prompt: string) => void;
}

export function InpaintToolbar({ version, onInpaintRevision }: InpaintToolbarProps) {
  const strokes = useInpaintMaskStore((state) => state.strokes);
  const prompt = useInpaintMaskStore((state) => state.prompt);
  const setPrompt = useInpaintMaskStore((state) => state.setPrompt);
  const clearMask = useInpaintMaskStore((state) => state.clearMask);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
          maskImage
        })
      });

      if (!response.ok) {
        throw new Error(`inpaint-plan failed with ${response.status}`);
      }

      const data = (await response.json()) as { version?: PlanVersion; warning?: string };

      if (!data.version?.rooms) {
        throw new Error("inpaint-plan did not return a complete PlanVersion.");
      }

      onInpaintRevision(data.version, prompt.trim());
      clearMask();
      setNotice(data.warning ? `Inpaint applied with fallback: ${data.warning}` : "Masked region updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Inpaint request failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mb-3 rounded border border-warning/35 bg-warning/10 p-3">
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
          <Eraser className="h-3 w-3" />
          Clear mask
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">Paint the region to edit, then describe the localized design change.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 min-w-[240px] flex-1 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
          disabled={isSending}
          placeholder="e.g. widen this corridor and add a nurse station alcove"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button
          className="h-9 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSending || strokes.length === 0 || !prompt.trim() || !version}
          type="button"
          onClick={() => void submitInpaint()}
        >
          {isSending ? "Applying..." : `Apply inpaint (${strokes.length})`}
        </button>
      </div>
      {notice ? <div className="mt-2 text-xs text-warning">{notice}</div> : null}
    </div>
  );
}
