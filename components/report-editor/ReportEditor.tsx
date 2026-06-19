"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DocumentEditor } from "@/components/report-editor/DocumentEditor";
import { SlideEditor } from "@/components/report-editor/SlideEditor";
import { buildReportDocument } from "@/lib/report-content-builder";
import { downloadReportPdf, renderReportDocumentHtml, renderSlideLayoutHtml } from "@/lib/report-export";
import { buildSlideLayout } from "@/lib/report-layout-engine";
import type { ReportBlock, ReportDocument, ReportSection, SlideLayout } from "@/lib/report-types";
import type { DesignBrief, PlanVersion, Point, ProjectData } from "@/lib/project-types";
import type { BuildableEnvelope, EnvironmentSurrogate, SiteContext } from "@/lib/site-types";

interface ReportEditorProps {
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
  siteContext?: SiteContext;
  envelope?: BuildableEnvelope;
  environmentSurrogate?: EnvironmentSurrogate;
  outline?: Point[];
  onClose: () => void;
}

export function ReportEditor({
  project,
  version,
  brief,
  siteContext,
  envelope,
  environmentSurrogate,
  outline,
  onClose
}: ReportEditorProps) {
  const initialDocument = useMemo(
    () =>
      buildReportDocument({
        project,
        version,
        brief,
        siteContext,
        envelope,
        environmentSurrogate,
        outline
      }),
    [brief, envelope, environmentSurrogate, outline, project, siteContext, version]
  );
  const [document, setDocument] = useState<ReportDocument>(initialDocument);
  const [layout, setLayout] = useState<SlideLayout>(() => buildSlideLayout(initialDocument));
  const [mode, setMode] = useState<"document" | "slides">("document");
  const [selected, setSelected] = useState<{ sectionId: string; blockId: string } | undefined>();
  const [instruction, setInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeSlideId, setActiveSlideId] = useState(layout.slides[0]?.id);

  useEffect(() => {
    setDocument(initialDocument);
    setLayout(buildSlideLayout(initialDocument));
  }, [initialDocument]);

  function updateSection(sectionId: string, updater: (section: ReportSection) => ReportSection) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === sectionId ? updater(section) : section))
    }));
  }

  function handleBlockChange(sectionId: string, blockId: string, nextBlock: ReportBlock) {
    updateSection(sectionId, (section) => ({
      ...section,
      blocks: section.blocks.map((block) => (block.id === blockId ? nextBlock : block))
    }));
  }

  async function runAiEdit() {
    if (!selected || !instruction.trim()) {
      return;
    }

    const section = document.sections.find((item) => item.id === selected.sectionId);

    if (!section) {
      return;
    }

    setIsEditing(true);
    setNotice(null);

    try {
      const response = await fetch("/api/edit-report-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          blockId: selected.blockId,
          instruction: instruction.trim(),
          allSections: document.sections
        })
      });

      if (!response.ok) {
        throw new Error(`edit-report-section failed with ${response.status}`);
      }

      const data = (await response.json()) as {
        sections: ReportSection[];
        rejectedOutOfScope?: boolean;
        scopeViolations?: Array<{ message: string }>;
      };

      setDocument((current) => ({ ...current, sections: data.sections }));
      setInstruction("");

      if (data.rejectedOutOfScope) {
        setNotice(data.scopeViolations?.[0]?.message ?? "Out-of-scope AI edits were discarded.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AI edit failed.");
    } finally {
      setIsEditing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid grid-rows-[auto_minmax(0,1fr)] bg-[#070b10]">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h1 className="text-base font-semibold text-white">{document.title}</h1>
          <p className="text-xs text-muted">Single content source · document and slide layouts stay in sync</p>
        </div>
        <div className="flex items-center gap-2">
          <ModeButton active={mode === "document"} label="Document" onClick={() => setMode("document")} />
          <ModeButton active={mode === "slides"} label="Slides" onClick={() => setMode("slides")} />
          <button
            className="rounded border border-line px-3 py-1.5 text-xs text-slate-100 hover:border-accent/50"
            type="button"
            onClick={() => void downloadReportPdf(renderReportDocumentHtml(document), `${document.title}.pdf`)}
          >
            Export PDF
          </button>
          <button
            className="rounded border border-line px-3 py-1.5 text-xs text-slate-100 hover:border-accent/50"
            type="button"
            onClick={() => {
              const blob = new Blob([renderSlideLayoutHtml(document, layout)], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const anchor = window.document.createElement("a");
              anchor.href = url;
              anchor.download = `${document.title}-slides.html`;
              anchor.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export slides HTML
          </button>
          <button className="grid h-8 w-8 place-items-center rounded border border-line text-muted" type="button" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-4 p-4">
        <div className="min-h-0 overflow-hidden rounded border border-line bg-panel/40 p-4">
          {mode === "document" ? (
            <DocumentEditor
              sections={document.sections}
              selectedBlockId={selected?.blockId}
              onSelectBlock={(sectionId, blockId) => setSelected({ sectionId, blockId })}
              onBlockChange={handleBlockChange}
            />
          ) : (
            <SlideEditor
              activeSlideId={activeSlideId}
              document={document}
              layout={layout}
              onSelectSlide={setActiveSlideId}
              onElementMove={(slideId, blockRef, patch) => {
                setLayout((current) => ({
                  ...current,
                  slides: current.slides.map((slide) =>
                    slide.id === slideId
                      ? {
                          ...slide,
                          elements: slide.elements.map((element) =>
                            element.blockRef === blockRef ? { ...element, ...patch } : element
                          )
                        }
                      : slide
                  )
                }));
              }}
              onElementResize={(slideId, blockRef, patch) => {
                setLayout((current) => ({
                  ...current,
                  slides: current.slides.map((slide) =>
                    slide.id === slideId
                      ? {
                          ...slide,
                          elements: slide.elements.map((element) =>
                            element.blockRef === blockRef ? { ...element, ...patch } : element
                          )
                        }
                      : slide
                  )
                }));
              }}
            />
          )}
        </div>

        <aside className="flex min-h-0 flex-col rounded border border-line bg-panel/70 p-3">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            <Sparkles className="h-4 w-4 text-accent" />
            AI section edit
          </div>
          <p className="mb-3 text-xs leading-5 text-muted">
            Each rewrite re-grounds from original project facts — not from prior polished text — to prevent drift.
          </p>
          {selected ? (
            <div className="mb-2 rounded border border-line bg-[#0b1118] p-2 text-[11px] text-slate-200">
              Target: {selected.blockId}
            </div>
          ) : (
            <div className="mb-2 rounded border border-dashed border-line p-2 text-[11px] text-muted">
              Select a paragraph or list block in document mode.
            </div>
          )}
          <textarea
            className="mb-2 min-h-[120px] rounded border border-line bg-[#0b1118] p-2 text-sm text-slate-100 outline-none focus:border-accent/60"
            placeholder='e.g. "Make this section more client-friendly" or "Emphasize daylight performance"'
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
          />
          <button
            className="flex h-9 items-center justify-center gap-2 rounded bg-accent text-xs font-medium text-[#061014] disabled:opacity-50"
            disabled={!selected || !instruction.trim() || isEditing}
            type="button"
            onClick={() => void runAiEdit()}
          >
            {isEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Rewrite from grounding
          </button>
          {notice ? <div className="mt-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">{notice}</div> : null}
        </aside>
      </div>
    </div>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded border px-3 py-1.5 text-xs ${
        active ? "border-accent/60 text-accent" : "border-line text-muted hover:text-slate-100"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
