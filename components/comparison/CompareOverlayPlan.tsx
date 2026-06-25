"use client";

import { getViewBox, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import { FurnitureOverlayLayer } from "@/components/workflow/layers/FurnitureOverlayLayer";
import { StructureOverlayLayer } from "@/components/workflow/layers/StructureOverlayLayer";
import type { FurnitureLayout, StructuralSystem } from "@/lib/building-domain";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion } from "@/lib/project-types";
import type { CompareLensId } from "@/lib/compare/types";

interface CompareOverlayPlanProps {
  version: PlanVersion;
  levelId?: string;
  lens: Extract<CompareLensId, "structure" | "furniture">;
  structuralSystem?: StructuralSystem;
  furnitureLayout?: FurnitureLayout;
  className?: string;
}

export function CompareOverlayPlan({
  version,
  levelId,
  lens,
  structuralSystem,
  furnitureLayout,
  className
}: CompareOverlayPlanProps) {
  const resolvedLevel = levelId ? getResolvedLevel(version, levelId) : undefined;
  const rooms = resolvedLevel?.rooms ?? version.rooms;

  return (
    <div className={`overflow-hidden rounded border border-line bg-[#081018] ${className ?? ""}`}>
      <svg className="h-full min-h-[220px] w-full" viewBox={getViewBox(version, 4)} role="img">
        <polygon
          fill="rgba(255,255,255,0.02)"
          points={polygonPoints(version.outline)}
          stroke="rgba(216,237,245,0.35)"
          strokeWidth="0.2"
        />
        {rooms.map((room) => (
          <polygon
            key={room.id}
            fill="rgba(148,163,184,0.08)"
            points={polygonPoints(room.polygon)}
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="0.14"
          />
        ))}
        {lens === "structure" ? (
          <StructureOverlayLayer structuralSystem={structuralSystem} levelId={levelId} />
        ) : (
          <FurnitureOverlayLayer layout={furnitureLayout} levelId={levelId} />
        )}
      </svg>
    </div>
  );
}
