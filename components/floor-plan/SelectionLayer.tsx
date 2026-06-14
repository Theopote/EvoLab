import type { Room } from "@/lib/project-types";
import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";

interface SelectionLayerProps {
  rooms: Room[];
  selectedRoomId?: string;
}

export function SelectionLayer({ rooms, selectedRoomId }: SelectionLayerProps) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);

  if (!selectedRoom) {
    return null;
  }

  return (
    <g data-layer="selection">
      <polygon
        points={polygonPoints(selectedRoom.polygon)}
        fill="rgba(79,181,200,0.08)"
        stroke="#4fb5c8"
        strokeDasharray="0.8 0.45"
        strokeWidth="0.45"
      />
    </g>
  );
}
