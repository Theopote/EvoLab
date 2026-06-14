"use client";

import { useShallow } from "zustand/react/shallow";
import type { PlanVersion } from "@/lib/project-types";
import { CoreSymbolLayer } from "@/components/floor-plan/layers/CoreSymbolLayer";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { LabelLayer } from "@/components/floor-plan/layers/LabelLayer";
import { OpeningLayer } from "@/components/floor-plan/layers/OpeningLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { SelectionLayer } from "@/components/floor-plan/layers/SelectionLayer";
import { WallLayer } from "@/components/floor-plan/layers/WallLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { useEvoProject } from "@/lib/project-store";
import { createSetbackBoundary } from "@/lib/polygon-offset";

export interface FloorPlanCanvasProps {
  version?: PlanVersion;
  className?: string;
  levelId?: string;
  selectedRoomId?: string;
  interactive?: boolean;
}

export function FloorPlanCanvas({
  version,
  className,
  levelId: levelIdProp,
  selectedRoomId: selectedRoomIdProp,
  interactive = true
}: FloorPlanCanvasProps) {
  const {
    selectedRoomId: roomSelectionFromStore,
    selectedWallId: wallSelectionFromStore,
    selectedOpeningId: openingSelectionFromStore,
    activeLevelId,
    selectRoom,
    selectWall,
    selectOpening,
    clearSelection
  } = useEvoProject(
    useShallow((state) => ({
      selectedRoomId: state.selectedRoomId,
      selectedWallId: state.selectedWallId,
      selectedOpeningId: state.selectedOpeningId,
      activeLevelId: state.activeLevelId,
      selectRoom: state.selectRoom,
      selectWall: state.selectWall,
      selectOpening: state.selectOpening,
      clearSelection: state.clearSelection
    }))
  );
  const selectedRoomId = interactive ? selectedRoomIdProp ?? roomSelectionFromStore : selectedRoomIdProp;
  const selectedWallId = interactive ? wallSelectionFromStore : undefined;
  const selectedOpeningId = interactive ? openingSelectionFromStore : undefined;

  if (!version) {
    return (
      <div className={className}>
        <div className="grid h-full min-h-[420px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
          Draw an outline and generate plan options.
        </div>
      </div>
    );
  }

  const levelId = levelIdProp ?? (interactive ? activeLevelId : undefined);
  const level = version.levels.find((item) => item.id === levelId) ?? version.levels[0];
  const rooms = level?.rooms.length ? level.rooms : version.rooms;
  const visibleVersion = { ...version, rooms };
  const setback = createSetbackBoundary(version.outline, 3);
  const selectedRoom = selectedRoomId ? rooms.find((room) => room.id === selectedRoomId) : undefined;
  const selectedWall = selectedWallId ? level?.walls.find((wall) => wall.id === selectedWallId) : undefined;
  const selectedOpening = selectedOpeningId
    ? level?.openings.find((opening) => opening.id === selectedOpeningId)
    : undefined;
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
          <GridLayer version={visibleVersion} />
          <OutlineLayer version={version} setback={setback} />
          <RoomFillLayer
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelectRoom={interactive ? selectRoom : undefined}
          />
          <WallLayer
            walls={level?.walls ?? []}
            selectedWallId={selectedWallId}
            onSelectWall={interactive ? selectWall : undefined}
          />
          <OpeningLayer
            openings={level?.openings ?? []}
            walls={level?.walls ?? []}
            selectedOpeningId={selectedOpeningId}
            onSelectOpening={interactive ? selectOpening : undefined}
          />
          <CoreSymbolLayer rooms={rooms} />
          <LabelLayer version={visibleVersion} />
          <SelectionLayer
            rooms={rooms}
            walls={level?.walls ?? []}
            openings={level?.openings ?? []}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            selectedOpeningId={selectedOpeningId}
          />
        </svg>
        <div className="absolute bottom-3 left-3 rounded border border-line bg-[#081018]/90 px-2 py-1 text-xs text-muted">
          1 grid = 1 m / {version.label}
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
