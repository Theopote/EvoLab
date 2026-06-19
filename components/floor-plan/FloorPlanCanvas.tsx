"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
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
import { ParametricOpeningToolbar } from "@/components/floor-plan/ParametricOpeningToolbar";
import { RoomTopologyToolbar } from "@/components/floor-plan/RoomTopologyToolbar";
import { WallLayer } from "@/components/floor-plan/layers/WallLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { useEvoProject } from "@/lib/project-store";
import { useInteractionStore } from "@/lib/interaction-store";
import { createSetbackBoundary } from "@/lib/polygon-offset";
import { useEditPreviewStore } from "@/lib/edit-preview-store";
import { corridorComplianceRoomIds } from "@/lib/drag-compliance";
import { normalizePlanVersion } from "@/lib/architecture-model";
import type { GridSnapStep } from "@/lib/plan-snap";
import { clientToSvgPoint } from "@/components/floor-plan/floor-plan-utils";
import { useLocalFormEditStore } from "@/lib/local-form-edit-store";
import { deriveWallGraph, hitTestWalls } from "@/lib/wall-graph";

export interface FloorPlanCanvasProps {
  version?: PlanVersion;
  className?: string;
  levelId?: string;
  selectedRoomId?: string;
  interactive?: boolean;
  onInpaintRevision?: (version: PlanVersion, prompt: string) => void;
}

function roomsGeometrySignature(rooms: Room[]) {
  return JSON.stringify(rooms.map((room) => [room.id, room.polygon]));
}

export function FloorPlanCanvas({
  version,
  className,
  levelId: levelIdProp,
  selectedRoomId: selectedRoomIdProp,
  interactive = true,
  onInpaintRevision
}: FloorPlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragBaseSignatureRef = useRef<string>("");
  const [gridStep, setGridStep] = useState<GridSnapStep>(0.1);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
  const [hoveredWallId, setHoveredWallId] = useState<string | undefined>();
  const protrusionWidthM = useLocalFormEditStore((state) => state.protrusionWidthM);
  const resetLocalFormEdit = useLocalFormEditStore((state) => state.reset);
  const activeTool = useInteractionStore((state) => state.activeTool);
  const previewRooms = useEditPreviewStore((state) => state.previewRooms);
  const complianceRoomIds = useEditPreviewStore((state) => state.complianceRoomIds);
  const dragHint = useEditPreviewStore((state) => state.dragHint);
  const setPreviewRooms = useEditPreviewStore((state) => state.setPreviewRooms);
  const clearPreview = useEditPreviewStore((state) => state.clearPreview);
  const {
    selectedRoomId: roomSelectionFromStore,
    selectedWallId: wallSelectionFromStore,
    selectedOpeningId: openingSelectionFromStore,
    activeLevelId,
    selectRoom,
    selectWall,
    selectOpening,
    clearSelection,
    applyLevelRoomsGeometry,
    splitActiveRoom,
    mergeActiveRoomWith,
    addParametricOpening,
    updateOpening,
    lockedElementIds
  } = useEvoProject(
    useShallow((state) => ({
      selectedRoomId: state.selectedRoomId,
      selectedWallId: state.selectedWallId,
      selectedOpeningId: state.selectedOpeningId,
      activeLevelId: state.activeLevelId,
      selectRoom: state.selectRoom,
      selectWall: state.selectWall,
      selectOpening: state.selectOpening,
      clearSelection: state.clearSelection,
      applyLevelRoomsGeometry: state.applyLevelRoomsGeometry,
      splitActiveRoom: state.splitActiveRoom,
      mergeActiveRoomWith: state.mergeActiveRoomWith,
      addParametricOpening: state.addParametricOpening,
      updateOpening: state.updateOpening,
      lockedElementIds: state.project.domain.lockedElementIds
    }))
  );
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
  const sourceRooms = level?.rooms.length ? level.rooms : version?.rooms ?? [];
  const rooms = previewRooms ?? sourceRooms;
  const wallGraph = useMemo(() => deriveWallGraph(sourceRooms), [sourceRooms]);
  const previewWalls = useMemo(() => {
    if (!version || !previewRooms) {
      return level?.walls ?? [];
    }

    const normalized = normalizePlanVersion({ ...version, rooms: previewRooms });
    const previewLevel = normalized.levels.find((item) => item.id === levelId) ?? normalized.levels[0];
    return previewLevel?.walls ?? [];
  }, [level?.walls, levelId, previewRooms, version]);

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
      {inpaintEnabled && onInpaintRevision ? (
        <InpaintToolbar version={version} onInpaintRevision={onInpaintRevision} />
      ) : null}
      {sketchInputEnabled && onInpaintRevision ? (
        <SketchInputToolbar version={version} onSketchRevision={onInpaintRevision} />
      ) : null}
      {reshapeBoundaryEnabled && onInpaintRevision ? (
        <ReshapeBoundaryToolbar
          levelId={levelId}
          roomId={selectedRoomId}
          version={version}
          onApplyRevision={onInpaintRevision}
        />
      ) : null}
      {addProtrusionEnabled && onInpaintRevision ? (
        <AddProtrusionToolbar levelId={levelId} version={version} onApplyRevision={onInpaintRevision} />
      ) : null}
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
          viewBox={getViewBox(version)}
          role="img"
          onPointerLeave={interactive ? handleCanvasPointerLeave : undefined}
          onPointerMove={interactive ? handleCanvasPointerMove : undefined}
          onClick={() => {
            if (interactive && !traceEnabled && !drawingToolEnabled && !localFormEditEnabled) {
              clearSelection();
            }
          }}
        >
          <GridLayer version={visibleVersion} />
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
          {inpaintEnabled ? " / Inpaint mask" : ""}
          {sketchInputEnabled ? " / Sketch input" : ""}
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
}
