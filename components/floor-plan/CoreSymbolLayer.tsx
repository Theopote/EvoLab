import type { Room } from "@/lib/project-types";
import { getCentroid } from "@/components/floor-plan/floor-plan-utils";

interface CoreSymbolLayerProps {
  rooms: Room[];
}

export function CoreSymbolLayer({ rooms }: CoreSymbolLayerProps) {
  return (
    <g data-layer="core-symbols">
      {rooms
        .filter((room) => ["stair", "elevator", "shaft"].includes(room.type))
        .map((room) => {
          const [x, y] = getCentroid(room);
          const label = room.type === "shaft" ? "S" : room.type === "elevator" ? "EV" : "ST";

          return (
            <g key={room.id}>
              <rect
                x={x - 2.6}
                y={y - 2.1}
                width="5.2"
                height="4.2"
                fill="rgba(8,16,24,0.64)"
                stroke="#f0b35b"
                strokeWidth="0.22"
              />
              {room.type === "stair" ? (
                Array.from({ length: 5 }, (_, index) => (
                  <line
                    key={`${room.id}-step-${index}`}
                    x1={x - 2}
                    y1={y - 1.4 + index * 0.65}
                    x2={x + 2}
                    y2={y - 1.4 + index * 0.65}
                    stroke="#f0b35b"
                    strokeWidth="0.11"
                  />
                ))
              ) : room.type === "elevator" ? (
                <>
                  <line x1={x - 2.2} y1={y} x2={x + 2.2} y2={y} stroke="#f0b35b" strokeWidth="0.11" />
                  <line x1={x} y1={y - 1.8} x2={x} y2={y + 1.8} stroke="#f0b35b" strokeWidth="0.11" />
                </>
              ) : (
                <>
                  <line x1={x - 2.1} y1={y - 1.6} x2={x + 2.1} y2={y + 1.6} stroke="#f0b35b" strokeWidth="0.11" />
                  <line x1={x + 2.1} y1={y - 1.6} x2={x - 2.1} y2={y + 1.6} stroke="#f0b35b" strokeWidth="0.11" />
                </>
              )}
              <text x={x} y={y + 0.35} fill="#f8d39d" fontSize="1.2" textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
    </g>
  );
}
