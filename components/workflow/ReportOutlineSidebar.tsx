"use client";

import { useMemo } from "react";
import { buildPresentationDeck } from "@/lib/presentation/storyboard";
import { usePresentationUiStore } from "@/lib/presentation-ui-store";
import { useProjectState, useSiteState } from "@/lib/project-store";

interface ReportOutlineSidebarProps {
  onOpenPresentation: () => void;
  /** @deprecated Use onOpenPresentation */
  onOpenSheets?: () => void;
  onOpenReportEditor?: () => void;
}

export function ReportOutlineSidebar({
  onOpenPresentation,
  onOpenSheets,
  onOpenReportEditor
}: ReportOutlineSidebarProps) {
  const openPresentation = onOpenPresentation ?? onOpenSheets;
  const { project, activeVersion, brief } = useProjectState((state) => ({
    project: state.project,
    activeVersion: state.activeVersion,
    brief: state.brief
  }));
  const { siteContext, buildableEnvelope, environmentSurrogate, outline } = useSiteState((state) => ({
    siteContext: state.siteContext,
    buildableEnvelope: state.buildableEnvelope,
    environmentSurrogate: state.environmentSurrogate,
    outline: state.outline
  }));
  const requestFocusSlide = usePresentationUiStore((state) => state.requestFocusSlide);

  const slides = useMemo(() => {
    if (!activeVersion) {
      return [];
    }

    return buildPresentationDeck({
      project,
      version: activeVersion,
      brief,
      siteContext,
      envelope: buildableEnvelope,
      environmentSurrogate,
      outline
    }).slides;
  }, [activeVersion, brief, buildableEnvelope, environmentSurrogate, outline, project, siteContext]);

  if (!activeVersion) {
    return (
      <div className="rounded border border-dashed border-line bg-panel/50 p-3 text-xs text-muted">
        Activate a plan version to preview the report outline.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Report Outline</h2>
        <div className="flex items-center gap-2">
          <button className="text-[11px] text-accent hover:underline" type="button" onClick={openPresentation}>
            Open presentation
          </button>
          {onOpenReportEditor ? (
            <button className="text-[11px] text-accent hover:underline" type="button" onClick={onOpenReportEditor}>
              Edit report
            </button>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        {slides.map((slide, index) => (
          <button
            className="w-full rounded border border-line bg-panel/70 px-2.5 py-2 text-left hover:border-accent/40"
            key={slide.id}
            type="button"
            onClick={() => {
              requestFocusSlide(slide.id);
              openPresentation?.();
            }}
          >
            <div className="text-[11px] text-muted">Slide {index + 1}</div>
            <div className="truncate text-xs text-slate-100">{slide.title}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
