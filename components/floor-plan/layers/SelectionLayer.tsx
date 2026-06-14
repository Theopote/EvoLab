import type { OpeningElement, Point, Room, Wall } from "@/lib/project-types";
import { openingSegment, polygonPoints } from "@/components/floor-plan/floor-plan-utils";

const VERTEX_R = 0.55;
const MIDPOINT_R = 0.38;

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function ControlPoints({ polygon }: { polygon: Point[] }) {
  const vertices = polygon;
  const midpoints: Point[] = polygon.map((pt, i) =>
    midpoint(pt, polygon[(i + 1) % polygon.length])
  );

  return (
    <g data-layer="control-points">
      {midpoints.map(([x, y], i) => (
        <circle
          key={`mp-${i}`}
          cx={x}
          cy={y}
          r={MIDPOINT_R}
          fill="#0d1c29"
          stroke="#4fb5c8"
          strokeWidth="0.14"
        />
      ))}
      {vertices.map(([x, y], i) => (
        <circle
          key={`vt-${i}`}
          cx={x}
          cy={y}
          r={VERTEX_R}
          fill="#4fb5c8"
          stroke="#e2e8f0"
          strokeWidth="0.16"
        />
      ))}
    </g>
  );
}

interface SelectionLayerProps {
  rooms: Room[];
  walls: Wall[];
  openings: OpeningElement[];
  selectedRoomId?: string;
  selectedWallId?: string;
  selectedOpeningId?: string;
}

export function SelectionLayer({
  rooms,
  walls,
  openings,
  selectedRoomId,
  selectedWallId,
  selectedOpeningId
}: SelectionLayerProps) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const selectedWall = walls.find((wall) => wall.id === selectedWallId);
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId);
  const selectedOpeningWall = selectedOpening ? walls.find((wall) => wall.id === selectedOpening.wallId) : undefined;

  if (!selectedRoom && !selectedWall && !selectedOpening) {
    return null;
  }

  const openingSelection = selectedOpening && selectedOpeningWall ? openingSegment(selectedOpening, selectedOpeningWall) : undefined;

  return (
    <g data-layer="selection">
      {selectedRoom ? (
        <>
          <polygon
            points={polygonPoints(selectedRoom.polygon)}
            fill="rgba(79,181,200,0.08)"
            stroke="#4fb5c8"
            strokeDasharray="0.8 0.45"
            strokeWidth="0.45"
          />
          <ControlPoints polygon={selectedRoom.polygon} />
        </>
      ) : null}

      {selectedWall ? (
        <line
          x1={selectedWall.start[0]}
          y1={selectedWall.start[1]}
          x2={selectedWall.end[0]}
          y2={selectedWall.end[1]}
          stroke="#f8fafc"
          strokeDasharray="0.5 0.35"
          strokeWidth={Math.max(0.42, selectedWall.thickness + 0.1)}
        />
      ) : null}

      {openingSelection ? (
        <line
          x1={openingSelection.start[0]}
          y1={openingSelection.start[1]}
          x2={openingSelection.end[0]}
          y2={openingSelection.end[1]}
          stroke="#fde68a"
          strokeWidth="0.42"
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}
