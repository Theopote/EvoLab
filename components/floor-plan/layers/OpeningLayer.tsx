import type { OpeningElement, Wall } from "@/lib/project-types";
import {
  findOpeningWall,
  openingSegment,
  wallAngle,
  wallNormal
} from "@/components/floor-plan/floor-plan-utils";

interface OpeningLayerProps {
  openings: OpeningElement[];
  walls: Wall[];
  selectedOpeningId?: string;
  onSelectOpening?: (openingId: string) => void;
}

export function OpeningLayer({ openings, walls, selectedOpeningId, onSelectOpening }: OpeningLayerProps) {
  return (
    <g data-layer="openings">
      {openings.map((opening) => {
        const wall = findOpeningWall(opening, walls);

        if (!wall) {
          return null;
        }

        const selected = opening.id === selectedOpeningId;
        const segment = openingSegment(opening, wall);
        const angle = wallAngle(wall);
        const normal = wallNormal(wall);
        const doorEnd = [
          segment.start[0] + normal[0] * opening.width,
          segment.start[1] + normal[1] * opening.width
        ];
        const largeArcFlag = opening.width > 1.5 ? 1 : 0;

        return (
          <g
            key={opening.id}
            className={onSelectOpening ? "cursor-pointer" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelectOpening?.(opening.id);
            }}
          >
            <line
              x1={segment.start[0]}
              y1={segment.start[1]}
              x2={segment.end[0]}
              y2={segment.end[1]}
              stroke="#081018"
              strokeLinecap="round"
              strokeWidth={Math.max(0.38, wall.thickness + 0.18)}
            />
            {opening.type === "door" ? (
              <>
                <line
                  x1={segment.start[0]}
                  y1={segment.start[1]}
                  x2={doorEnd[0]}
                  y2={doorEnd[1]}
                  stroke={selected ? "#fde68a" : "#d8edf5"}
                  strokeWidth={selected ? "0.2" : "0.16"}
                />
                <path
                  d={`M ${segment.end[0]} ${segment.end[1]} A ${opening.width} ${opening.width} 0 ${largeArcFlag} 0 ${doorEnd[0]} ${doorEnd[1]}`}
                  fill="none"
                  stroke={selected ? "#f59e0b" : "#4fb5c8"}
                  strokeDasharray="0.35 0.25"
                  strokeWidth={selected ? "0.16" : "0.12"}
                />
              </>
            ) : (
              <g transform={`rotate(${(angle * 180) / Math.PI} ${opening.center[0]} ${opening.center[1]})`}>
                <line
                  x1={opening.center[0] - opening.width / 2}
                  y1={opening.center[1] - 0.12}
                  x2={opening.center[0] + opening.width / 2}
                  y2={opening.center[1] - 0.12}
                  stroke={selected ? "#e2e8f0" : "#84cc16"}
                  strokeWidth={selected ? "0.15" : "0.11"}
                />
                <line
                  x1={opening.center[0] - opening.width / 2}
                  y1={opening.center[1] + 0.12}
                  x2={opening.center[0] + opening.width / 2}
                  y2={opening.center[1] + 0.12}
                  stroke={selected ? "#e2e8f0" : "#84cc16"}
                  strokeWidth={selected ? "0.15" : "0.11"}
                />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
