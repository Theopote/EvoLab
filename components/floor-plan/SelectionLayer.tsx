import type { Room } from "@/lib/project-types";
import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";

interface SelectionLayerProps {
  rooms: Room[];
  selectedRoomId?: string;
  hoveredRoomId?: string;
}

export function SelectionLayer({ rooms, selectedRoomId, hoveredRoomId }: SelectionLayerProps) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const hoveredRoom = rooms.find((room) => room.id === hoveredRoomId && room.id !== selectedRoomId);

  if (!selectedRoom && !hoveredRoom) {
    return null;
  }

  return (
    <g data-layer="selection">
      {hoveredRoom ? (
        <polygon
          points={polygonPoints(hoveredRoom.polygon)}
          fill="rgba(255,255,255,0.04)"
          stroke="#cbd5e1"
          strokeDasharray="0.55 0.4"
          strokeWidth="0.28"
        />
      ) : null}
      {selectedRoom ? (
        <polygon
          points={polygonPoints(selectedRoom.polygon)}
          fill="rgba(79,181,200,0.08)"
          stroke="#4fb5c8"
          strokeDasharray="0.8 0.45"
          strokeWidth="0.45"
        />
      ) : null}
    </g>
  );
}
