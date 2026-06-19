"use client";

import { PlanChangeProposalDiffPreview } from "@/components/copilot/PlanChangeProposalDiffPreview";
import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import type { PlanVersion, Point } from "@/lib/project-types";

interface DiffPreviewOverlayProps {
  title: string;
  baseVersion: PlanVersion;
  previewVersion: PlanVersion;
  highlightRoomIds?: string[];
  needsReviewRoomIds?: string[];
  notice?: string;
  dimensionOverlay?: {
    widthM: number;
    depthM: number;
    label: string;
  };
  sketchUnderlay?: {
    strokes: Point[][];
    ghostLoops?: Point[][];
  };
  onAccept: () => void;
  onReject: () => void;
}

export function DiffPreviewOverlay({
  title,
  baseVersion,
  previewVersion,
  highlightRoomIds = [],
  needsReviewRoomIds = [],
  notice,
  dimensionOverlay,
  sketchUnderlay,
  onAccept,
  onReject
}: DiffPreviewOverlayProps) {
  const reviewIds = new Set(needsReviewRoomIds);

  return (
    <div className="mb-3 rounded border border-accent/35 bg-[#081018] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{title}</div>
        <div className="flex items-center gap-2">
          <button
            className="h-8 rounded border border-line px-3 text-xs text-slate-100"
            type="button"
            onClick={onReject}
          >
            Reject
          </button>
          <button
            className="h-8 rounded bg-accent px-3 text-xs font-medium text-[#061014]"
            type="button"
            onClick={onAccept}
          >
            Accept changes
          </button>
        </div>
      </div>
      {notice ? <p className="mb-2 text-xs text-muted">{notice}</p> : null}
      {dimensionOverlay ? (
        <div className="mb-2 inline-flex items-center gap-2 rounded border border-line px-2 py-1 text-[11px] text-slate-100">
          <span className="text-muted">Size</span>
          <span>{dimensionOverlay.label}</span>
          <span className="text-muted">
            W {dimensionOverlay.widthM.toFixed(2)}m · D {dimensionOverlay.depthM.toFixed(2)}m
          </span>
        </div>
      ) : null}
      {sketchUnderlay ? (
        <div className="mb-2 rounded border border-line/70 bg-[#0b1118] p-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted">Sketch underlay</div>
          <svg className="h-24 w-full opacity-80" viewBox={`0 0 ${baseVersion.overallBounds.width} ${baseVersion.overallBounds.height}`}>
            {sketchUnderlay.strokes.map((stroke, index) => (
              <polyline
                key={`underlay-stroke-${index}`}
                points={polygonPoints(stroke)}
                fill="none"
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="0.35"
              />
            ))}
            {sketchUnderlay.ghostLoops?.map((loop, index) => (
              <polygon
                key={`underlay-loop-${index}`}
                points={polygonPoints([...loop, loop[0]])}
                fill="rgba(79,181,200,0.06)"
                stroke="rgba(79,181,200,0.35)"
                strokeDasharray="0.5 0.35"
                strokeWidth="0.25"
              />
            ))}
          </svg>
        </div>
      ) : null}
      <PlanChangeProposalDiffPreview
        baseVersion={baseVersion}
        previewVersion={previewVersion}
        highlightRoomIds={[...new Set([...highlightRoomIds, ...needsReviewRoomIds])]}
        focusedRoomIds={[...reviewIds]}
        reviewRoomIds={needsReviewRoomIds}
      />
      {needsReviewRoomIds.length > 0 ? (
        <p className="mt-2 text-[11px] text-warning">
          Orange dashed rooms need review before accepting the sketch result.
        </p>
      ) : null}
    </div>
  );
}
