"use client";

import { PlanChangeProposalDiffPreview } from "@/components/copilot/PlanChangeProposalDiffPreview";
import type { PlanVersion } from "@/lib/project-types";

interface DiffPreviewOverlayProps {
  title: string;
  baseVersion: PlanVersion;
  previewVersion: PlanVersion;
  highlightRoomIds?: string[];
  notice?: string;
  onAccept: () => void;
  onReject: () => void;
}

export function DiffPreviewOverlay({
  title,
  baseVersion,
  previewVersion,
  highlightRoomIds = [],
  notice,
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
      <PlanChangeProposalDiffPreview
        baseVersion={baseVersion}
        previewVersion={previewVersion}
        highlightRoomIds={highlightRoomIds}
      />
    </div>
  );
}
