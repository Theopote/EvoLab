"use client";

import type { PlanVersion } from "@/lib/project-types";

interface ReferenceImageLayerProps {
  version: PlanVersion;
  previewUrl: string;
  opacity: number;
}

export function ReferenceImageLayer({ version, previewUrl, opacity }: ReferenceImageLayerProps) {
  return (
    <g data-layer="import-reference" opacity={opacity}>
      <image
        height={version.overallBounds.height}
        href={previewUrl}
        preserveAspectRatio="xMidYMid meet"
        width={version.overallBounds.width}
        x={0}
        y={0}
      />
    </g>
  );
}
