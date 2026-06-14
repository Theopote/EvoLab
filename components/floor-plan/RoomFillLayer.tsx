import type { Room } from "@/lib/project-types";
import { polygonPoints, zoneColors, zoneStrokes } from "@/components/floor-plan/floor-plan-utils";

interface RoomFillLayerProps {
  rooms: Room[];
}

export function RoomFillLayer({ rooms }: RoomFillLayerProps) {
  return (
    <g data-layer="room-fill">
      {rooms.map((room) => (
        <polygon
          key={room.id}
          points={polygonPoints(room.polygon)}
          fill={zoneColors[room.zone]}
          stroke={zoneStrokes[room.zone]}
          strokeWidth="0.16"
        />
      ))}
    </g>
  );
}
