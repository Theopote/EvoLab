"use client";

import { Camera, Download, FileText, Layers, Loader2, Presentation, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { PresentationCaptureCanvas } from "@/components/presentation/PresentationCaptureCanvas";
import { attachModelCaptures } from "@/lib/presentation/merge-captures";
import { MODEL_SLIDE_ID, extractModelCaptures } from "@/lib/presentation/model-slide";
import { downloadPresentationHtml, downloadPresentationViaApi, renderPresentationHtml } from "@/lib/presentation/render-html";
import { downloadPresentationPptxViaApi, prepareDeckForPptx } from "@/lib/presentation/render-pptx-client";
import { buildPresentationDeck } from "@/lib/presentation/storyboard";
import { presentationTemplates } from "@/lib/presentation/templates";
import type { PresentationDeck, PresentationTemplateId } from "@/lib/presentation/types";
import { usePresentationCaptureStore } from "@/lib/presentation-capture-store";
import { usePresentationUiStore } from "@/lib/presentation-ui-store";
import { useEvoProject } from "@/lib/project-store";

export function PresentationWorkspace() {
  const { project, activeVersion, brief, outline, siteContext, zoning, buildableEnvelope, environmentSurrogate } =
    useEvoProject(
    useShallow((state) => ({
      project: state.project,
      activeVersion: state.activeVersion,
      brief: state.brief,
      outline: state.outline,
      siteContext: state.siteContext,
      zoning: state.zoning,
      buildableEnvelope: state.buildableEnvelope,
      environmentSurrogate: state.environmentSurrogate
    }))
  );
  const captureStatus = usePresentationCaptureStore((state) => state.status);
  const captureImages = usePresentationCaptureStore((state) => state.images);
  const captureError = usePresentationCaptureStore((state) => state.error);
  const requestCapture = usePresentationCaptureStore((state) => state.requestCapture);
  const resetCapture = usePresentationCaptureStore((state) => state.resetCapture);
  const consumeFocusSlide = usePresentationUiStore((state) => state.consumeFocusSlide);
  const focusSlideId = usePresentationUiStore((state) => state.focusSlideId);

  const [deck, setDeck] = useState<PresentationDeck | undefined>(undefined);
  const [templateId, setTemplateId] = useState<PresentationTemplateId>("classic");
  const [activeSlide, setActiveSlide] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuildingFullDeck, setIsBuildingFullDeck] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [isExportingServerHtml, setIsExportingServerHtml] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const localDeck = useMemo(() => {
    if (!activeVersion) {
      return undefined;
    }

    return buildPresentationDeck({
      project,
      version: activeVersion,
      brief,
      siteContext,
      envelope: buildableEnvelope,
      environmentSurrogate,
      outline
    });
  }, [activeVersion, brief, buildableEnvelope, environmentSurrogate, outline, project, siteContext]);

  const currentDeck = deck ?? localDeck;
  const exportDeck = currentDeck ? { ...currentDeck, templateId } : undefined;
  const slide = currentDeck?.slides[activeSlide];

  useEffect(() => {
    if (!focusSlideId || !currentDeck) {
      return;
    }

    const index = currentDeck.slides.findIndex((item) => item.id === focusSlideId);

    if (index >= 0) {
      setActiveSlide(index);
    }

    consumeFocusSlide();
  }, [consumeFocusSlide, currentDeck, focusSlideId]);

  useEffect(() => {
    if (captureStatus !== "done" || captureImages.length === 0) {
      return;
    }

    setDeck((previous) => {
      const base = previous ?? localDeck;

      if (!base) {
        return previous;
      }

      return attachModelCaptures(base, captureImages);
    });

    const modelSlideIndex = (deck ?? localDeck)?.slides.findIndex((item) => item.id === MODEL_SLIDE_ID) ?? -1;
    if (modelSlideIndex >= 0) {
      setActiveSlide(modelSlideIndex);
    }

    setNotice(
      isBuildingFullDeck
        ? `Full deck ready: storyboard plus ${captureImages.length} WebGL views.`
        : `Captured ${captureImages.length} WebGL views and inserted into the deck.`
    );
    setIsBuildingFullDeck(false);
    resetCapture();
  }, [captureImages, captureStatus, deck, isBuildingFullDeck, localDeck, resetCapture]);

  useEffect(() => {
    if (captureStatus === "error" && captureError) {
      setNotice(captureError);
      setIsBuildingFullDeck(false);
      resetCapture();
    }
  }, [captureError, captureStatus, resetCapture]);

  async function fetchStoryboardDeck(): Promise<PresentationDeck> {
    if (!activeVersion) {
      throw new Error("No active version.");
    }

    const response = await fetch("/api/generate-storyboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        version: activeVersion,
        brief,
        siteContext,
        zoning,
        outline,
        environmentSurrogate
      })
    });

    if (!response.ok) {
      throw new Error(`generate-storyboard failed with ${response.status}`);
    }

    const data = (await response.json()) as {
      deck?: PresentationDeck;
      warning?: string;
      storyArc?: string[];
    };

    if (!data.deck) {
      throw new Error("No presentation deck returned.");
    }

    const preservedCaptures = extractModelCaptures(deck ?? localDeck);
    const mergedDeck = {
      ...(preservedCaptures.length ? attachModelCaptures(data.deck, preservedCaptures) : data.deck),
      templateId
    };

    setDeck(mergedDeck);
    setActiveSlide(0);
    setNotice(
      data.warning
        ? data.warning
        : data.storyArc?.length
          ? `Story arc: ${data.storyArc.join(" → ")}`
          : "Storyboard generated."
    );

    return mergedDeck;
  }

  async function generateStoryboard() {
    if (!activeVersion) {
      return;
    }

    setIsGenerating(true);
    setNotice(null);

    try {
      await fetchStoryboardDeck();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to generate storyboard.");
      if (localDeck) {
        setDeck(localDeck);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function buildFullDeck() {
    if (!activeVersion) {
      return;
    }

    setIsBuildingFullDeck(true);
    setIsGenerating(true);
    setNotice("Building full deck: AI storyboard, then 3D captures…");

    try {
      await fetchStoryboardDeck();
      requestCapture();
    } catch (error) {
      setIsBuildingFullDeck(false);
      setNotice(error instanceof Error ? error.message : "Failed to build full deck.");
      if (localDeck) {
        setDeck(localDeck);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function exportHtml() {
    if (!exportDeck) {
      return;
    }

    downloadPresentationHtml(exportDeck);
  }

  async function exportServerHtml() {
    if (!exportDeck) {
      return;
    }

    setIsExportingServerHtml(true);
    setNotice(null);

    try {
      await downloadPresentationViaApi(exportDeck);
      setNotice("Presentation HTML downloaded via server export API.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Server HTML export failed.");
    } finally {
      setIsExportingServerHtml(false);
    }
  }

  function printPdf() {
    if (!exportDeck) {
      return;
    }

    const popup = window.open("", "_blank");

    if (!popup) {
      setNotice("Allow pop-ups to print the presentation as PDF.");
      return;
    }

    popup.document.write(renderPresentationHtml(exportDeck));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function exportPptx() {
    if (!exportDeck) {
      return;
    }

    setIsExportingPptx(true);
    setNotice(null);

    try {
      const prepared = await prepareDeckForPptx(exportDeck);
      await downloadPresentationPptxViaApi(prepared);
      setNotice("PowerPoint deck exported.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to export PPTX.");
    } finally {
      setIsExportingPptx(false);
    }
  }

  function captureModelViews() {
    if (!activeVersion) {
      return;
    }

    setNotice("Capturing isometric, eye-level, plan, and exploded views from the 3D scene…");
    requestCapture();
  }

  if (!activeVersion) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate a plan version to build an automated presentation deck.
      </div>
    );
  }

  return (
    <>
      <PresentationCaptureCanvas />

      <section className="rounded border border-line bg-panel/90 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Automated Presentation</h2>
            <p className="mt-1 text-xs text-muted">
              Storyboard, evolution narrative, diagrams, cost ROM, 3D captures, and AI per-slide copy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-muted" htmlFor="presentation-template">
              Template
            </label>
            <select
              className="h-9 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
              id="presentation-template"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value as PresentationTemplateId)}
            >
              {Object.values(presentationTemplates).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="flex h-9 items-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 text-xs text-accent hover:border-accent/60"
              type="button"
              onClick={buildFullDeck}
              disabled={isGenerating || captureStatus === "capturing"}
            >
              {isBuildingFullDeck ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
              Build full deck
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded border border-line px-3 text-xs text-slate-100 hover:border-accent/50"
              type="button"
              onClick={generateStoryboard}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate storyboard
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded border border-line px-3 text-xs text-slate-100 hover:border-accent/50"
              type="button"
              onClick={captureModelViews}
              disabled={captureStatus === "capturing"}
            >
              {captureStatus === "capturing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              Capture 3D views
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded border border-line px-3 text-xs text-slate-100 hover:border-accent/50"
              type="button"
              onClick={exportHtml}
              disabled={!currentDeck}
            >
              <Download className="h-3.5 w-3.5" />
              Export HTML
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded border border-line px-3 text-xs text-slate-100 hover:border-accent/50"
              type="button"
              onClick={() => void exportServerHtml()}
              disabled={!currentDeck || isExportingServerHtml}
            >
              {isExportingServerHtml ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Server HTML
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded border border-line px-3 text-xs text-slate-100 hover:border-accent/50"
              type="button"
              onClick={exportPptx}
              disabled={!currentDeck || isExportingPptx}
            >
              {isExportingPptx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export PPTX
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded bg-accent px-3 text-xs font-medium text-[#061014]"
              type="button"
              onClick={printPdf}
              disabled={!currentDeck}
            >
              <FileText className="h-3.5 w-3.5" />
              Print / PDF
            </button>
          </div>
        </div>

        {notice ? <div className="mb-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">{notice}</div> : null}
        {currentDeck?.storyArc?.length ? (
          <div className="mb-3 rounded border border-line bg-[#0b1118] p-2 text-xs text-slate-300">
            <span className="text-muted">Story arc:</span> {currentDeck.storyArc.join(" → ")}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="space-y-2">
            {currentDeck?.slides.map((item, index) => (
              <button
                key={item.id}
                className={`w-full rounded border px-3 py-2 text-left text-xs ${
                  index === activeSlide ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-muted"
                }`}
                type="button"
                onClick={() => setActiveSlide(index)}
              >
                <div className="font-medium text-slate-100">{item.title}</div>
                <div className="mt-1 capitalize">{item.kind}</div>
              </button>
            ))}
          </aside>

          <article className="rounded border border-line bg-[#0b1118] p-4">
            {slide ? (
              <>
                <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                  <Presentation className="h-3.5 w-3.5" />
                  {slide.subtitle ?? currentDeck?.versionLabel}
                </div>
                <h3 className="text-lg font-semibold text-white">{slide.title}</h3>
                <ul className="mt-3 space-y-1 text-sm text-slate-300">
                  {slide.bullets.map((bullet) => (
                    <li key={bullet}>• {bullet}</li>
                  ))}
                </ul>
                {slide.images?.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {slide.images.map((image) => (
                      <figure key={image.id} className="overflow-hidden rounded border border-line bg-[#081018]">
                        <img alt={image.label} className="h-40 w-full object-cover" src={image.dataUrl} />
                        <figcaption className="px-2 py-1 text-xs text-muted">{image.label}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : slide.id === MODEL_SLIDE_ID ? (
                  <div className="mt-4 grid min-h-[180px] place-items-center rounded border border-dashed border-line bg-[#081018] px-4 text-center text-sm text-muted">
                    No WebGL captures yet. Use Capture 3D views or Build full deck.
                  </div>
                ) : null}
                {slide.svg ? (
                  <div
                    className={`mt-4 overflow-hidden rounded border border-line bg-[#081018] [&_svg]:w-full ${
                      slide.kind === "evolution"
                        ? "presentation-evolution-preview [&_svg]:h-[360px]"
                        : "[&_svg]:h-[320px]"
                    }`}
                    dangerouslySetInnerHTML={{ __html: slide.svg }}
                  />
                ) : null}
                {slide.table ? (
                  <div className="mt-4 overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-muted">
                          {slide.table.headers.map((header) => (
                            <th className="px-2 py-2" key={header}>
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {slide.table.rows.map((row, rowIndex) => (
                          <tr className="border-b border-line/60" key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                              <td className="px-2 py-2 text-slate-200" key={cellIndex}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            ) : null}
          </article>
        </div>
      </section>
      <style>{`
        .presentation-evolution-preview svg > g:nth-child(2) { animation: evolab-panel 4.5s ease-in-out infinite; }
        .presentation-evolution-preview svg > g:nth-child(3) { animation: evolab-panel 4.5s ease-in-out infinite 1.5s; }
        .presentation-evolution-preview svg > g:nth-child(4) { animation: evolab-panel 4.5s ease-in-out infinite 3s; }
        @keyframes evolab-panel {
          0%, 18% { opacity: 0.3; }
          28%, 72% { opacity: 1; }
          82%, 100% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
