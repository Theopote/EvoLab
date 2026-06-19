"use client";

import { PlanChangeProposalDiffPreview } from "@/components/copilot/PlanChangeProposalDiffPreview";
import type { PlanVersion } from "@/lib/project-types";

interface DiffPreviewOverlayProps {
  title: string;
  baseVersion: PlanVersion;
  previewVersion: PlanVersion;
  highlightRoomIds?: string[];
  notice?: string;
  dimensionOverlay?: {
    widthM: number;
    depthM: number;
    label: string;
  };
  onAccept: () => void;
  onReject: () => void;
}

export function DiffPreviewOverlay({
  title,
  baseVersion,
  previewVersion,
  highlightRoomIds = [],
  notice,
  dimensionOverlay,
  onAccept,
  onReject
}: DiffPreviewOverlayProps) {
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
      <PlanChangeProposalDiffPreview
        baseVersion={baseVersion}
        previewVersion={previewVersion}
        highlightRoomIds={highlightRoomIds}
      />
    </div>
  );
}
