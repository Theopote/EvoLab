"use client";

import { useMemo } from "react";
import { SchemeGeometryDiff } from "@/components/comparison/SchemeGeometryDiff";
import { summarizeRoomChanges } from "@/lib/plan-change-diff";
import type { PlanVersion } from "@/lib/project-types";

interface PlanChangeProposalDiffPreviewProps {
  baseVersion: PlanVersion;
  previewVersion: PlanVersion;
  highlightRoomIds?: string[];
  focusedRoomIds?: string[];
  reviewRoomIds?: string[];
}

export function PlanChangeProposalDiffPreview({
  baseVersion,
  previewVersion,
  highlightRoomIds = [],
  focusedRoomIds = [],
  reviewRoomIds = []
}: PlanChangeProposalDiffPreviewProps) {
  const changes = useMemo(() => summarizeRoomChanges(baseVersion, previewVersion), [baseVersion, previewVersion]);

  return (
    <div className="rounded border border-line bg-[#081018] p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-slate-100">Geometry diff</div>
      </div>

      <SchemeGeometryDiff
        baseVersion={baseVersion}
        previewVersion={previewVersion}
        changes={changes}
        highlightRoomIds={highlightRoomIds}
        focusedRoomIds={focusedRoomIds}
        reviewRoomIds={reviewRoomIds}
        heightClassName="h-36"
      />
    </div>
  );
}
