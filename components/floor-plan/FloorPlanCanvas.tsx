"use client";

import type { PlanVersion } from "@/lib/project-types";
import { CoreSymbolLayer } from "@/components/floor-plan/CoreSymbolLayer";
import { LabelLayer } from "@/components/floor-plan/LabelLayer";
import { OpeningLayer } from "@/components/floor-plan/OpeningLayer";
import { OutlineLayer } from "@/components/floor-plan/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/RoomFillLayer";
import { SelectionLayer } from "@/components/floor-plan/SelectionLayer";
import { WallLayer } from "@/components/floor-plan/WallLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { useInteractionStore } from "@/lib/interaction-store";
import { createSetbackBoundary } from "@/lib/polygon-offset";

export interface FloorPlanCanvasProps {
  version?: PlanVersion;
  className?: string;
  selectedRoomId?: string;
  interactive?: boolean;
}

export function FloorPlanCanvas({
  version,
  className,
  selectedRoomId: selectedRoomIdProp,
  interactive = true
}: FloorPlanCanvasProps) {
  const selectedRoomId = useInteractionStore((state) => selectedRoomIdProp ?? state.selectedRoomId);
  const hoveredRoomId = useInteractionStore((state) => state.hoveredRoomId);
  const selectRoom = useInteractionStore((state) => state.selectRoom);
  const hoverRoom = useInteractionStore((state) => state.hoverRoom);
  const clearSelection = useInteractionStore((state) => state.clearSelection);

  if (!version) {
    return (
      <div className={className}>
        <div className="grid h-full min-h-[420px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
          Draw an outline and generate plan options.
        </div>
      </div>
    );
  }

  const level = version.levels[0];
  const setback = createSetbackBoundary(version.outline, 3);

  return (
    <div className={className}>
      <div className="relative min-h-[420px] overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
        <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
        <svg
          className="relative h-full min-h-[420px] w-full"
          viewBox={getViewBox(version)}
          role="img"
          onClick={() => {
            if (interactive) {
              clearSelection();
            }
          }}
        >
          <OutlineLayer version={version} setback={setback} />
          <RoomFillLayer
            rooms={version.rooms}
            hoveredRoomId={interactive ? hoveredRoomId : undefined}
            selectedRoomId={selectedRoomId}
            onHoverRoom={interactive ? hoverRoom : undefined}
            onSelectRoom={interactive ? selectRoom : undefined}
          />
          <WallLayer walls={level?.walls ?? []} />
          <OpeningLayer openings={level?.openings ?? []} walls={level?.walls ?? []} />
          <CoreSymbolLayer rooms={version.rooms} />
          <LabelLayer version={version} />
          <SelectionLayer
            rooms={version.rooms}
            hoveredRoomId={interactive ? hoveredRoomId : undefined}
            selectedRoomId={selectedRoomId}
          />
        </svg>
        <div className="absolute bottom-3 left-3 rounded border border-line bg-[#081018]/90 px-2 py-1 text-xs text-muted">
          1 grid = 1 m / {version.label}
        </div>
      </div>
    </div>
  );
}
