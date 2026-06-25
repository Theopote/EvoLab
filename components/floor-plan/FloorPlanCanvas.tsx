"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanVersion, Room } from "@/lib/project-types";
import { CoreSymbolLayer } from "@/components/floor-plan/layers/CoreSymbolLayer";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { LabelLayer } from "@/components/floor-plan/layers/LabelLayer";
import { OpeningLayer } from "@/components/floor-plan/layers/OpeningLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { SelectionLayer } from "@/components/floor-plan/layers/SelectionLayer";
import { InpaintMaskLayer } from "@/components/floor-plan/layers/InpaintMaskLayer";
import { InpaintToolbar } from "@/components/floor-plan/InpaintToolbar";
import { SketchInputLayer } from "@/components/sketch-input/SketchInputLayer";
import { SketchInputToolbar } from "@/components/sketch-input/SketchInputToolbar";
import { ReshapeBoundaryToolbar } from "@/components/floor-plan/ReshapeBoundaryToolbar";
import { AddProtrusionToolbar } from "@/components/floor-plan/AddProtrusionToolbar";
import { BoundarySpanLayer } from "@/components/floor-plan/layers/BoundarySpanLayer";
import { ProtrusionPlacementLayer } from "@/components/floor-plan/layers/ProtrusionPlacementLayer";
import { ReferenceImageLayer } from "@/components/floor-plan/layers/ReferenceImageLayer";
import { ParametricOpeningToolbar } from "@/components/floor-plan/ParametricOpeningToolbar";
import { RoomTopologyToolbar } from "@/components/floor-plan/RoomTopologyToolbar";
import { WallLayer } from "@/components/floor-plan/layers/WallLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { parseViewBox, formatViewBox } from "@/lib/comparison-viewport";
import { getResolvedLevel, resolveLevelOutline } from "@/lib/level-rooms";
import {
  useFloorPlanEditorState,
  useGeometryActions,
  useSelectionActions
} from "@/lib/project-store";
import { useInteractionStore } from "@/lib/interaction-store";
import { createSetbackBoundary } from "@/lib/polygon-offset";
import { useEditPreviewStore } from "@/lib/edit-preview-store";
import { corridorComplianceRoomIds } from "@/lib/drag-compliance";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { applyLevelWallDrag } from "@/lib/geometry/walls/apply-wall-drag";
import type { WallDragCommitInput } from "@/lib/store/types";
import type { GridSnapStep } from "@/lib/plan-snap";
import { clientToSvgPoint } from "@/components/floor-plan/floor-plan-utils";
import { useLocalFormEditStore } from "@/lib/local-form-edit-store";
import { useSketchInputStore } from "@/lib/sketch-input-store";
import { deriveWallGraph, hitTestWalls } from "@/lib/wall-graph";
import { useImportSessionStore } from "@/lib/import-session-store";

export interface FloorPlanCanvasProps {
  version?: PlanVersion;
  className?: string;
  levelId?: string;
  selectedRoomId?: string;
  interactive?: boolean;
  viewBoxOverride?: string;
  onViewBoxChange?: (viewBox: string) => void;
  enableComparisonPan?: boolean;
}

function roomsGeometrySignature(rooms: Room[]) {
  return JSON.stringify(rooms.map((room) => [room.id, room.polygon]));
}

export const FloorPlanCanvas = memo(function FloorPlanCanvas({
  version,
  className,
  levelId: levelIdProp,
  selectedRoomId: selectedRoomIdProp,
  interactive = true,
  viewBoxOverride,
  onViewBoxChange,
  enableComparisonPan = false
}: FloorPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragBaseSignatureRef = useRef<string>("");
  const [gridStep, setGridStep] = useState<GridSnapStep>(0.1);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [hoveredWallId, setHoveredWallId] = useState<string | undefined>();
  const protrusionWidthM = useLocalFormEditStore((state) => state.protrusionWidthM);
  const resetLocalFormEdit = useLocalFormEditStore((state) => state.reset);
  const activeTool = useInteractionStore((state) => state.activeTool);
  const recognitionStatus = useSketchInputStore((state) => state.recognitionStatus);
  const importReference = useImportSessionStore((state) =>
    version && state.reference?.versionId === version.id ? state.reference : undefined
  );
  const setReferenceOpacity = useImportSessionStore((state) => state.setReferenceOpacity);
  const previewRooms = useEditPreviewStore((state) => state.previewRooms);
  const previewWallsFromStore = useEditPreviewStore((state) => state.previewWalls);
  const complianceRoomIds = useEditPreviewStore((state) => state.complianceRoomIds);
  const dragHint = useEditPreviewStore((state) => state.dragHint);
  const setPreviewRooms = useEditPreviewStore((state) => state.setPreviewRooms);
  const setPreviewWallGeometry = useEditPreviewStore((state) => state.setPreviewWallGeometry);
  const clearPreview = useEditPreviewStore((state) => state.clearPreview);
  const {
    selectedRoomId: roomSelectionFromStore,
    selectedWallId: wallSelectionFromStore,
    selectedOpeningId: openingSelectionFromStore,
    activeLevelId,
    lockedElementIds
  } = useFloorPlanEditorState();
  const { selectRoom, selectWall, selectOpening, clearSelection } = useSelectionActions();
  const {
    applyLevelRoomsGeometry,
    applyWallDragCommit,
    splitActiveRoom,
    mergeActiveRoomWith,
    addParametricOpening,
    updateOpening
  } = useGeometryActions();
  const selectedRoomId = interactive ? selectedRoomIdProp ?? roomSelectionFromStore : selectedRoomIdProp;
  const selectedWallId = interactive ? wallSelectionFromStore : undefined;
  const selectedOpeningId = interactive ? openingSelectionFromStore : undefined;

  useEffect(() => {
    if (activeTool !== "reshape_boundary" && activeTool !== "add_protrusion") {
      return;
    }

    return () => {
      resetLocalFormEdit();
    };
  }, [activeTool, resetLocalFormEdit]);

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

  const handleRoomsGeometryPreview = useCallback(
    (rooms: Room[], hint?: string | null) => {
      if (!dragBaseSignatureRef.current) {
        dragBaseSignatureRef.current = roomsGeometrySignature(rooms);
      }

      setPreviewRooms(rooms, corridorComplianceRoomIds(rooms), hint ?? null);
    },
    [setPreviewRooms]
  );

  const handleRoomsGeometryCommit = useCallback(
    (rooms: Room[]) => {
      const changed = roomsGeometrySignature(rooms) !== dragBaseSignatureRef.current;
      dragBaseSignatureRef.current = "";
      clearPreview();

      if (changed) {
        applyLevelRoomsGeometry(rooms);
      }
    },
    [applyLevelRoomsGeometry, clearPreview]
  );

  const handleRoomsGeometryCancel = useCallback(() => {
    dragBaseSignatureRef.current = "";
    clearPreview();
  }, [clearPreview]);

  const levelId = levelIdProp ?? (interactive ? activeLevelId : undefined);
  const level = version?.levels.find((item) => item.id === levelId) ?? version?.levels[0];
  const resolvedLevel = version && level ? getResolvedLevel(version, level.id) : undefined;
  const sourceRooms = resolvedLevel?.rooms ?? version?.rooms ?? [];

  const handleWallDragPreview = useCallback(
    (input: WallDragCommitInput) => {
      if (!level || !version) {
        return;
      }

      const levelOutline = resolveLevelOutline(level, version.standardFloorGroups, version.outline);
      const previewLevel = applyLevelWallDrag(level, input.wallId, input.offset, input.normal, levelOutline);

      setPreviewWallGeometry(
        previewLevel.rooms,
        previewLevel.walls,
        corridorComplianceRoomIds(previewLevel.rooms),
        "Drag wall · release to commit"
      );
    },
    [level, setPreviewWallGeometry, version]
  );

  const handleWallDragCommit = useCallback(
    (input: WallDragCommitInput) => {
      clearPreview();

      if (input.offset !== 0) {
        applyWallDragCommit(input);
      }
    },
    [applyWallDragCommit, clearPreview]
  );

  const rooms = previewRooms ?? sourceRooms;
  const wallGraph = useMemo(() => deriveWallGraph(sourceRooms), [sourceRooms]);
  const previewWalls = useMemo(() => {
    if (previewWallsFromStore) {
      return previewWallsFromStore;
    }

    if (!version || !previewRooms) {
      return level?.walls ?? [];
    }

    const normalized = normalizePlanVersion({ ...version, rooms: previewRooms });
    const previewLevel = normalized.levels.find((item) => item.id === levelId) ?? normalized.levels[0];
    return previewLevel?.walls ?? [];
  }, [level?.walls, levelId, previewRooms, previewWallsFromStore, version]);

  const handleCanvasPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!interactive || activeTool !== "select" || previewRooms) {
        return;
      }

      const svgElement = svgRef.current;

      if (!svgElement) {
        return;
      }

      const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);
      const hit = hitTestWalls([x, y], wallGraph);
      setHoveredWallId(hit?.id);
    },
    [activeTool, interactive, previewRooms, wallGraph]
  );

  const handleCanvasPointerLeave = useCallback(() => {
    setHoveredWallId(undefined);
  }, []);

  const resolvedViewBox = viewBoxOverride ?? (version ? getViewBox(version) : "0 0 100 100");

  const handleComparisonWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      if (!enableComparisonPan || !onViewBoxChange) {
        return;
      }

      event.preventDefault();
      const parsed = parseViewBox(resolvedViewBox);

      if (!parsed) {
        return;
      }

      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      const nextWidth = parsed.width * factor;
      const nextHeight = parsed.height * factor;
      const dx = (parsed.width - nextWidth) / 2;
      const dy = (parsed.height - nextHeight) / 2;

      onViewBoxChange(
        formatViewBox({
          x: parsed.x + dx,
          y: parsed.y + dy,
          width: nextWidth,
          height: nextHeight
        })
      );
    },
    [enableComparisonPan, onViewBoxChange, resolvedViewBox]
  );

  if (!version) {
    return (
      <div className={className}>
        <div className="grid h-full min-h-[420px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
          Draw an outline and generate plan options.
        </div>
      </div>
    );
  }

  const visibleVersion = { ...version, rooms };
  const setback = createSetbackBoundary(version.outline, 3);
  const selectedRoom = selectedRoomId ? rooms.find((room) => room.id === selectedRoomId) : undefined;
  const selectedWall = selectedWallId ? previewWalls.find((wall) => wall.id === selectedWallId) : undefined;
  const selectedOpening = selectedOpeningId
    ? level?.openings.find((opening) => opening.id === selectedOpeningId)
    : undefined;
  const traceEnabled = interactive && activeTool === "trace";
  const inpaintEnabled = interactive && activeTool === "inpaint";
  const sketchInputEnabled = interactive && activeTool === "sketch_input";
  const reshapeBoundaryEnabled = interactive && activeTool === "reshape_boundary";
  const addProtrusionEnabled = interactive && activeTool === "add_protrusion";
  const localFormEditEnabled = reshapeBoundaryEnabled || addProtrusionEnabled;
  const drawingToolEnabled = inpaintEnabled || sketchInputEnabled;
  const directWallDragEnabled =
    interactive && !drawingToolEnabled && !localFormEditEnabled && (activeTool === "select" || activeTool === "trace");
  const roomTopologyEnabled =
    interactive &&
    activeTool === "select" &&
    !drawingToolEnabled &&
    !localFormEditEnabled &&
    Boolean(selectedRoom && !lockedElementIds.includes(selectedRoom.id));
  const geometryEditEnabled =
    interactive &&
    !drawingToolEnabled &&
    !localFormEditEnabled &&
    (activeTool === "select" || activeTool === "trace") &&
    Boolean(selectedRoom && !lockedElementIds.includes(selectedRoom.id));
  const wallDragEnabled =
    interactive &&
    directWallDragEnabled &&
    Boolean(selectedWallId) &&
    Boolean(selectedWall && !selectedWall.roomIds.some((roomId) => lockedElementIds.includes(roomId)));
  const hoveredWall = hoveredWallId ? previewWalls.find((wall) => wall.id === hoveredWallId) : undefined;
  const hoveredWallDraggable =
    directWallDragEnabled &&
    Boolean(hoveredWall && !hoveredWall.roomIds.some((roomId) => lockedElementIds.includes(roomId)));
  const canvasCursor = previewRooms ? "grabbing" : hoveredWallDraggable ? "grab" : undefined;
  const parametricOpeningEnabled =
    interactive && activeTool === "select" && Boolean(selectedWall) && wallDragEnabled;
  const openingEditEnabled =
    interactive &&
    activeTool === "select" &&
    !drawingToolEnabled &&
    !localFormEditEnabled &&
    Boolean(selectedOpeningId) &&
    Boolean(
      selectedOpening &&
        !lockedElementIds.includes(selectedOpening.id) &&
        !(selectedOpening.roomIds ?? []).some((roomId) => lockedElementIds.includes(roomId))
    );
  const hud = selectedRoom
    ? {
        type: "ROOM",
        id: selectedRoom.id,
        details: `${selectedRoom.name} / ${selectedRoom.areaSqm} sqm`
      }
    : selectedWall
      ? {
          type: "WALL",
          id: selectedWall.id,
          details: `${selectedWall.type} / ${selectedWall.thickness.toFixed(2)} m`
        }
      : selectedOpening
        ? {
            type: "OPENING",
            id: selectedOpening.id,
            details: `${selectedOpening.type} / ${selectedOpening.width.toFixed(2)} x ${selectedOpening.height.toFixed(2)} m`
          }
        : undefined;

  return (
    <div className={className}>
      {inpaintEnabled ? <InpaintToolbar version={version} /> : null}
      {sketchInputEnabled ? <SketchInputToolbar version={version} /> : null}
      {reshapeBoundaryEnabled ? (
        <ReshapeBoundaryToolbar levelId={levelId} roomId={selectedRoomId} version={version} />
      ) : null}
      {addProtrusionEnabled ? <AddProtrusionToolbar levelId={levelId} version={version} /> : null}
      {roomTopologyEnabled && selectedRoom ? (
        <RoomTopologyToolbar
          disabled={Boolean(previewRooms)}
          room={selectedRoom}
          rooms={sourceRooms}
          onMerge={mergeActiveRoomWith}
          onSplit={splitActiveRoom}
        />
      ) : null}
      {parametricOpeningEnabled && selectedWall ? (
        <ParametricOpeningToolbar
          rooms={rooms}
          wall={selectedWall}
          walls={previewWalls}
          onAddOpening={addParametricOpening}
        />
      ) : null}
      <div className="relative min-h-[420px] overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
        <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
        <svg
          ref={svgRef}
          className="relative h-full min-h-[420px] w-full"
          style={canvasCursor ? { cursor: canvasCursor } : undefined}
          viewBox={resolvedViewBox}
          role="img"
          onWheel={enableComparisonPan ? handleComparisonWheel : undefined}
          onPointerLeave={interactive ? handleCanvasPointerLeave : undefined}
          onPointerMove={interactive ? handleCanvasPointerMove : undefined}
          onClick={() => {
            if (interactive && !traceEnabled && !drawingToolEnabled && !localFormEditEnabled) {
              clearSelection();
            }
          }}
        >
          <GridLayer version={visibleVersion} />
          {traceEnabled && importReference ? (
            <ReferenceImageLayer
              opacity={importReference.opacity}
              previewUrl={importReference.previewUrl}
              version={version}
            />
          ) : null}
          <OutlineLayer version={version} setback={setback} />
          <RoomFillLayer
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            violationRoomIds={complianceRoomIds}
            onSelectRoom={interactive && !drawingToolEnabled && !addProtrusionEnabled ? selectRoom : interactive && reshapeBoundaryEnabled ? selectRoom : undefined}
          />
          <WallLayer
            walls={previewWalls}
            rooms={sourceRooms}
            hoveredWallId={hoveredWallId}
            selectedWallId={selectedWallId}
            wallDragEnabled={directWallDragEnabled}
            lockedElementIds={lockedElementIds}
            gridSnapEnabled={gridSnapEnabled}
            gridStep={gridStep}
            svgRef={svgRef}
            onSelectWall={interactive && !drawingToolEnabled && !localFormEditEnabled ? selectWall : undefined}
            onRoomsGeometryCancel={handleRoomsGeometryCancel}
            onRoomsGeometryCommit={handleRoomsGeometryCommit}
            onRoomsGeometryPreview={handleRoomsGeometryPreview}
          />
          <OpeningLayer
            openings={level?.openings ?? []}
            walls={previewWalls}
            selectedOpeningId={selectedOpeningId}
            onSelectOpening={interactive && !drawingToolEnabled && !localFormEditEnabled ? selectOpening : undefined}
          />
          <CoreSymbolLayer rooms={rooms} />
          <LabelLayer version={visibleVersion} />
          <SelectionLayer
            rooms={rooms}
            walls={previewWalls}
            openings={level?.openings ?? []}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            selectedOpeningId={selectedOpeningId}
            geometryEditEnabled={geometryEditEnabled}
            wallDragEnabled={wallDragEnabled}
            openingEditEnabled={openingEditEnabled}
            gridSnapEnabled={gridSnapEnabled}
            gridStep={gridStep}
            svgRef={svgRef}
            onRoomsGeometryCancel={handleRoomsGeometryCancel}
            onRoomsGeometryCommit={handleRoomsGeometryCommit}
            onRoomsGeometryPreview={handleRoomsGeometryPreview}
            onWallDragCommit={interactive ? handleWallDragCommit : undefined}
            onWallDragPreview={interactive ? handleWallDragPreview : undefined}
            onOpeningCenterChange={(openingId, center) => updateOpening(openingId, { center })}
          />
          <InpaintMaskLayer svgRef={svgRef} version={version} enabled={inpaintEnabled} />
          <SketchInputLayer svgRef={svgRef} version={version} enabled={sketchInputEnabled} />
          <BoundarySpanLayer
            enabled={reshapeBoundaryEnabled && Boolean(selectedRoom && !lockedElementIds.includes(selectedRoom.id))}
            room={selectedRoom}
          />
          <ProtrusionPlacementLayer
            enabled={addProtrusionEnabled}
            rooms={rooms}
            wallGraph={wallGraph}
            walls={previewWalls}
            widthM={protrusionWidthM}
            svgRef={svgRef}
          />
        </svg>
        <div className="absolute bottom-3 left-3 rounded border border-line bg-[#081018]/90 px-2 py-1 text-xs text-muted">
          1 grid = 1 m / {version.label}
          {geometryEditEnabled ? " / Drag vertices or edge handles" : ""}
          {hoveredWallDraggable && !previewRooms ? " / Drag wall line" : ""}
          {traceEnabled ? " / Trace mode" : ""}
          {traceEnabled && importReference ? " / Reference underlay" : ""}
          {inpaintEnabled ? " / Inpaint mask" : ""}
          {sketchInputEnabled ? " / Sketch input" : ""}
          {sketchInputEnabled && recognitionStatus === "pending" ? " / pause to auto-label" : ""}
          {sketchInputEnabled && recognitionStatus === "recognizing" ? " / recognizing" : ""}
          {reshapeBoundaryEnabled ? " / Boundary reshape span" : ""}
          {addProtrusionEnabled ? " / Protrusion placement" : ""}
          {wallDragEnabled ? " / Drag shared wall" : ""}
          {openingEditEnabled ? " / Drag opening along wall" : ""}
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
          {!gridSnapEnabled ? <span className="text-[11px] text-warning">Grid snap off (Alt)</span> : null}
        </div>
        {traceEnabled && importReference ? (
          <div className="absolute right-3 top-3 rounded border border-line bg-[#081018]/95 px-3 py-2">
            <label className="flex items-center gap-2 text-[11px] text-muted">
              <span>Reference</span>
              <input
                className="accent-accent"
                max={100}
                min={10}
                type="range"
                value={Math.round(importReference.opacity * 100)}
                onChange={(event) => setReferenceOpacity(Number(event.target.value) / 100)}
              />
              <span className="w-8 text-right text-slate-100">{Math.round(importReference.opacity * 100)}%</span>
            </label>
          </div>
        ) : null}
        {interactive && hud ? (
          <div className="absolute bottom-3 right-3 rounded border border-accent/35 bg-[#081018]/95 px-3 py-2 text-xs">
            <div className="font-semibold tracking-wide text-accent">{hud.type}</div>
            <div className="mt-0.5 text-slate-100">{hud.id}</div>
            <div className="mt-0.5 text-muted">{hud.details}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
});
