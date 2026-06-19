"use client";

import { DoorOpen, RectangleHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type { Opening, Room, Wall } from "@/lib/project-types";
import { findWallForRoomOrientation } from "@/lib/opening-constraints";
import { wallLength } from "@/components/floor-plan/floor-plan-utils";

interface ParametricOpeningToolbarProps {
  wall: Wall;
  rooms: Room[];
  walls: Wall[];
  disabled?: boolean;
  onAddOpening: (input: {
    roomId: string;
    kind: "door" | "window";
    wall: Opening["wall"];
    position: number;
    width: number;
  }) => void;
}

function orientationForWall(wall: Wall, room: Room): Opening["wall"] | undefined {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];

  if (Math.abs(dx) >= Math.abs(dy)) {
    const roomCenterY = room.polygon.reduce((sum, [, y]) => sum + y, 0) / room.polygon.length;
    const wallY = (wall.start[1] + wall.end[1]) / 2;
    return roomCenterY >= wallY ? "south" : "north";
  }

  const roomCenterX = room.polygon.reduce((sum, [x]) => sum + x, 0) / room.polygon.length;
  const wallX = (wall.start[0] + wall.end[0]) / 2;
  return roomCenterX >= wallX ? "east" : "west";
}

export function ParametricOpeningToolbar({
  wall,
  rooms,
  walls,
  disabled = false,
  onAddOpening
}: ParametricOpeningToolbarProps) {
  const attachedRooms = useMemo(
    () => rooms.filter((room) => wall.roomIds.includes(room.id)),
    [rooms, wall.roomIds]
  );
  const [roomId, setRoomId] = useState(attachedRooms[0]?.id ?? "");
  const selectedRoom = attachedRooms.find((room) => room.id === roomId) ?? attachedRooms[0];
  const orientation = selectedRoom ? orientationForWall(wall, selectedRoom) : undefined;
  const resolvedWall = selectedRoom && orientation ? findWallForRoomOrientation(selectedRoom, orientation, walls) : wall;
  const maxWidth = Math.max(0.4, wallLength(resolvedWall) - 0.2);

  function place(kind: "door" | "window") {
    if (!selectedRoom || !orientation || disabled) {
      return;
    }

    onAddOpening({
      roomId: selectedRoom.id,
      kind,
      wall: orientation,
      position: 0.5,
      width: Math.min(kind === "door" ? 1.0 : 1.2, maxWidth)
    });
  }

  if (!selectedRoom || !orientation) {
    return null;
  }

  return (
    <div className="mb-3 rounded border border-line bg-panel/90 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100">Parametric opening</div>
      <p className="mb-3 text-xs text-muted">
        Place validated door/window parameters on the selected wall. Width and position are clamped to fit the wall segment.
      </p>
      {attachedRooms.length > 1 ? (
        <label className="mb-3 block text-xs text-muted">
          Host room
          <select
            className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
            value={selectedRoom.id}
            onChange={(event) => setRoomId(event.target.value)}
          >
            {attachedRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex h-9 items-center gap-2 rounded border border-accent/40 px-3 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          type="button"
          onClick={() => place("door")}
        >
          <DoorOpen className="h-3.5 w-3.5" />
          Add door (1.0 m)
        </button>
        <button
          className="inline-flex h-9 items-center gap-2 rounded border border-accent/40 px-3 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          type="button"
          onClick={() => place("window")}
        >
          <RectangleHorizontal className="h-3.5 w-3.5" />
          Add window (1.2 m)
        </button>
      </div>
      <div className="mt-2 text-[11px] text-muted">
        Wall length {wallLength(resolvedWall).toFixed(2)} m · orientation {orientation}
      </div>
    </div>
  );
}
