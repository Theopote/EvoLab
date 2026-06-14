import type { Room } from "@/lib/project-types";
import { polygonPoints, zoneColors, zoneStrokes } from "@/components/floor-plan/floor-plan-utils";

interface RoomFillLayerProps {
  rooms: Room[];
  hoveredRoomId?: string;
  selectedRoomId?: string;
  onHoverRoom?: (roomId?: string) => void;
  onSelectRoom?: (roomId: string) => void;
}

export function RoomFillLayer({
  rooms,
  hoveredRoomId,
  selectedRoomId,
  onHoverRoom,
  onSelectRoom
}: RoomFillLayerProps) {
  return (
    <g data-layer="room-fill">
      {rooms.map((room) => {
        const isInteractive = Boolean(onHoverRoom || onSelectRoom);
        const isHighlighted = room.id === hoveredRoomId || room.id === selectedRoomId;

        return (
          <polygon
            key={room.id}
            points={polygonPoints(room.polygon)}
            fill={zoneColors[room.zone]}
            stroke={isHighlighted ? "#ffffff" : zoneStrokes[room.zone]}
            strokeWidth={isHighlighted ? "0.28" : "0.16"}
            className={isInteractive ? "cursor-pointer" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelectRoom?.(room.id);
            }}
            onPointerEnter={() => onHoverRoom?.(room.id)}
            onPointerLeave={() => onHoverRoom?.(undefined)}
          />
        );
      })}
    </g>
  );
}
