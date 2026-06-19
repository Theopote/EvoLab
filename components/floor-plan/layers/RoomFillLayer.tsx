import type { Room } from "@/lib/project-types";
import { polygonPoints, zoneColors, zoneStrokes } from "@/components/floor-plan/floor-plan-utils";

interface RoomFillLayerProps {
  rooms: Room[];
  selectedRoomId?: string;
  violationRoomIds?: string[];
  onSelectRoom?: (roomId: string) => void;
}

export function RoomFillLayer({ rooms, selectedRoomId, violationRoomIds = [], onSelectRoom }: RoomFillLayerProps) {
  const violations = new Set(violationRoomIds);

  return (
    <g data-layer="room-fill">
      {rooms.map((room) => {
        const isSelected = room.id === selectedRoomId;
        const isViolation = violations.has(room.id);

        return (
          <polygon
            key={room.id}
            points={polygonPoints(room.polygon)}
            fill={isViolation ? "rgba(244,63,94,0.22)" : zoneColors[room.zone]}
            stroke={isViolation ? "#f43f5e" : isSelected ? "#ffffff" : zoneStrokes[room.zone]}
            strokeWidth={isSelected || isViolation ? "0.3" : "0.16"}
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
