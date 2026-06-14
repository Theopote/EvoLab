import type { Room } from "@/lib/project-types";
import { polygonPoints, zoneColors, zoneStrokes } from "@/components/floor-plan/floor-plan-utils";

interface RoomFillLayerProps {
  rooms: Room[];
  selectedRoomId?: string;
  onSelectRoom?: (roomId: string) => void;
}

export function RoomFillLayer({ rooms, selectedRoomId, onSelectRoom }: RoomFillLayerProps) {
  return (
    <g data-layer="room-fill">
      {rooms.map((room) => {
        const isSelected = room.id === selectedRoomId;

        return (
          <polygon
            key={room.id}
            points={polygonPoints(room.polygon)}
            fill={zoneColors[room.zone]}
            stroke={isSelected ? "#ffffff" : zoneStrokes[room.zone]}
            strokeWidth={isSelected ? "0.3" : "0.16"}
            className={onSelectRoom ? "cursor-pointer" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelectRoom?.(room.id);
            }}
          />
        );
      })}
    </g>
  );
}
