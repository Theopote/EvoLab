"use client";

import { Download, FileText, Loader2, Presentation, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { buildPresentationDeck } from "@/lib/presentation/storyboard";
import { downloadPresentationHtml, renderPresentationHtml } from "@/lib/presentation/render-html";
import type { PresentationDeck } from "@/lib/presentation/types";
import { useEvoProject } from "@/lib/project-store";

export function PresentationWorkspace() {
  const { project, activeVersion, brief, outline, siteContext, zoning, buildableEnvelope } = useEvoProject(
    useShallow((state) => ({
      project: state.project,
      activeVersion: state.activeVersion,
      brief: state.brief,
      outline: state.outline,
      siteContext: state.siteContext,
      zoning: state.zoning,
      buildableEnvelope: state.buildableEnvelope
    }))
  );
  const [deck, setDeck] = useState<PresentationDeck | undefined>(undefined);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
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
      envelope: buildableEnvelope
    });
  }, [activeVersion, brief, buildableEnvelope, project, siteContext]);

  const currentDeck = deck ?? localDeck;
  const slide = currentDeck?.slides[activeSlide];

  async function generateStoryboard() {
    if (!activeVersion) {
      return;
    }

    setIsGenerating(true);
    setNotice(null);

    try {
      const response = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          version: activeVersion,
          brief,
          siteContext,
          zoning,
          outline
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

      setDeck(data.deck);
      setActiveSlide(0);
      setNotice(
        data.warning
          ? data.warning
          : data.storyArc?.length
            ? `Story arc: ${data.storyArc.join(" → ")}`
            : "Storyboard generated."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to generate storyboard.");
      if (localDeck) {
        setDeck(localDeck);
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function exportHtml() {
    if (!currentDeck) {
      return;
    }

    downloadPresentationHtml(currentDeck);
  }

  function printPdf() {
    if (!currentDeck) {
      return;
    }

    const popup = window.open("", "_blank");

    if (!popup) {
      setNotice("Allow pop-ups to print the presentation as PDF.");
      return;
    }

    popup.document.write(renderPresentationHtml(currentDeck));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  if (!activeVersion) {
    return (
      <div className="grid min-h-[280px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate a plan version to build an automated presentation deck.
      </div>
    );
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Automated Presentation</h2>
          <p className="mt-1 text-xs text-muted">
            Storyboard, isometric / exploded diagrams, flow overlays, quantities, and AI design narrative.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            onClick={exportHtml}
            disabled={!currentDeck}
          >
            <Download className="h-3.5 w-3.5" />
            Export HTML
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
              {slide.svg ? (
                <div
                  className="mt-4 overflow-hidden rounded border border-line bg-[#081018] [&_svg]:h-[320px] [&_svg]:w-full"
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
  );
}
