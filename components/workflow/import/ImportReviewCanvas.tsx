"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { LabelLayer } from "@/components/floor-plan/layers/LabelLayer";
import { OpeningLayer } from "@/components/floor-plan/layers/OpeningLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { ReferenceImageLayer } from "@/components/floor-plan/layers/ReferenceImageLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { SelectionLayer } from "@/components/floor-plan/layers/SelectionLayer";
import { WallLayer } from "@/components/floor-plan/layers/WallLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { ImportTraceLayer } from "@/components/workflow/import/ImportTraceLayer";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { corridorComplianceRoomIds } from "@/lib/drag-compliance";
import { applyImportReviewRooms } from "@/lib/import-review-utils";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion, Room } from "@/lib/project-types";
import { createSetbackBoundary } from "@/lib/polygon-offset";
import type { GridSnapStep } from "@/lib/plan-snap";

export type ImportReviewMode = "vertices" | "trace";

interface ImportReviewCanvasProps {
  version: PlanVersion;
  mode: ImportReviewMode;
  selectedRoomId?: string;
  referenceImage?: {
    previewUrl: string;
    opacity: number;
  };
  className?: string;
  onSelectRoom: (roomId?: string) => void;
  onVersionChange: (version: PlanVersion) => void;
  onTracePolygon: (polygon: Room["polygon"]) => void;
}

function roomsGeometrySignature(rooms: Room[]) {
  return JSON.stringify(rooms.map((room) => [room.id, room.polygon]));
}

export function ImportReviewCanvas({
  version,
  mode,
  selectedRoomId,
  referenceImage,
  className,
  onSelectRoom,
  onVersionChange,
  onTracePolygon
}: ImportReviewCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragBaseSignatureRef = useRef("");
  const [gridStep, setGridStep] = useState<GridSnapStep>(0.1);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [previewRooms, setPreviewRooms] = useState<Room[] | null>(null);
  const [complianceRoomIds, setComplianceRoomIds] = useState<string[]>([]);
  const [dragHint, setDragHint] = useState<string | null>(null);

  const level = version.levels[0];
  const levelId = level?.id;
  const resolvedLevel = level ? getResolvedLevel(version, level.id) : undefined;
  const sourceRooms = resolvedLevel?.rooms ?? version.rooms;
  const rooms = previewRooms ?? sourceRooms;

  const previewWalls = useMemo(() => {
    if (!previewRooms) {
      return level?.walls ?? [];
    }

    const normalized = normalizePlanVersion({ ...version, rooms: previewRooms });
    const previewLevel = normalized.levels.find((item) => item.id === levelId) ?? normalized.levels[0];
    return previewLevel?.walls ?? [];
  }, [level?.walls, levelId, previewRooms, version]);

  const handleRoomsGeometryPreview = useCallback((nextRooms: Room[], hint?: string | null) => {
    if (!dragBaseSignatureRef.current) {
      dragBaseSignatureRef.current = roomsGeometrySignature(nextRooms);
    }

    setPreviewRooms(nextRooms);
    setComplianceRoomIds(corridorComplianceRoomIds(nextRooms));
    setDragHint(hint ?? null);
  }, []);

  const handleRoomsGeometryCommit = useCallback(
    (nextRooms: Room[]) => {
      const changed = roomsGeometrySignature(nextRooms) !== dragBaseSignatureRef.current;
      dragBaseSignatureRef.current = "";
      setPreviewRooms(null);
      setComplianceRoomIds([]);
      setDragHint(null);

      if (changed) {
        onVersionChange(applyImportReviewRooms(version, nextRooms));
      }
    },
    [onVersionChange, version]
  );

  const handleRoomsGeometryCancel = useCallback(() => {
    dragBaseSignatureRef.current = "";
    setPreviewRooms(null);
    setComplianceRoomIds([]);
    setDragHint(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setGridSnapEnabled(false);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Alt") {
        setGridSnapEnabled(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const visibleVersion = { ...version, rooms };
  const setback = createSetbackBoundary(version.outline, 3);
  const selectedRoom = selectedRoomId ? rooms.find((room) => room.id === selectedRoomId) : undefined;
  const geometryEditEnabled = mode === "vertices" && Boolean(selectedRoom);
  const traceEnabled = mode === "trace";
  const padding = 8;
  const overlayWidth = version.overallBounds.width + padding * 2;
  const overlayHeight = version.overallBounds.height + padding * 2;

  return (
    <div className={className}>
      <div className="relative min-h-[420px] overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
        <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
        <svg ref={svgRef} className="relative h-full min-h-[420px] w-full" viewBox={getViewBox(version)} role="img">
          {referenceImage ? (
            <ReferenceImageLayer
              opacity={referenceImage.opacity}
              previewUrl={referenceImage.previewUrl}
              version={version}
            />
          ) : null}
          <GridLayer version={visibleVersion} />
          <OutlineLayer version={version} setback={setback} />
          <RoomFillLayer
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            violationRoomIds={complianceRoomIds}
            onSelectRoom={mode === "vertices" ? onSelectRoom : undefined}
          />
          <WallLayer walls={previewWalls} rooms={sourceRooms} wallDragEnabled={false} lockedElementIds={[]} />
          <OpeningLayer openings={level?.openings ?? []} walls={previewWalls} />
          <LabelLayer version={visibleVersion} />
          <SelectionLayer
            geometryEditEnabled={geometryEditEnabled}
            gridSnapEnabled={gridSnapEnabled}
            gridStep={gridStep}
            openingEditEnabled={false}
            openings={level?.openings ?? []}
            rooms={rooms}
            selectedOpeningId={undefined}
            selectedRoomId={selectedRoomId}
            selectedWallId={undefined}
            svgRef={svgRef}
            wallDragEnabled={false}
            walls={previewWalls}
            onCancelPreview={handleRoomsGeometryCancel}
            onCommitRooms={handleRoomsGeometryCommit}
            onPreviewRooms={handleRoomsGeometryPreview}
          />
          <ImportTraceLayer
            enabled={traceEnabled}
            overlayHeight={overlayHeight}
            overlayWidth={overlayWidth}
            svgRef={svgRef}
            onCompletePolygon={onTracePolygon}
          />
        </svg>
        <div className="absolute bottom-3 left-3 rounded border border-line bg-[#081018]/90 px-2 py-1 text-xs text-muted">
          {mode === "vertices"
            ? "Select a room, then drag vertices or edge midpoints."
            : "Click to place trace points. Double-click to close the room polygon."}
          {dragHint ? ` / ${dragHint}` : previewRooms ? " / Preview only — release to commit" : ""}
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <button
            className={`rounded border px-2 py-1 text-[11px] ${
              gridStep === 0.1 ? "border-accent/50 text-accent" : "border-line text-muted"
            }`}
            type="button"
            onClick={() => setGridStep(0.1)}
          >
            Snap 100mm
          </button>
          <button
            className={`rounded border px-2 py-1 text-[11px] ${
              gridStep === 0.3 ? "border-accent/50 text-accent" : "border-line text-muted"
            }`}
            type="button"
            onClick={() => setGridStep(0.3)}
          >
            Snap 300mm
          </button>
        </div>
      </div>
    </div>
  );
}
