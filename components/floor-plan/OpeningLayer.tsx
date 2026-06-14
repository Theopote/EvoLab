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
}

export function OpeningLayer({ openings, walls }: OpeningLayerProps) {
  return (
    <g data-layer="openings">
      {openings.map((opening) => {
        const wall = findOpeningWall(opening, walls);

        if (!wall) {
          return null;
        }

        const segment = openingSegment(opening, wall);
        const angle = wallAngle(wall);
        const normal = wallNormal(wall);
        const doorEnd = [
          segment.start[0] + normal[0] * opening.width,
          segment.start[1] + normal[1] * opening.width
        ];
        const largeArcFlag = opening.width > 1.5 ? 1 : 0;

        return (
          <g key={opening.id}>
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
                  stroke="#d8edf5"
                  strokeWidth="0.16"
                />
                <path
                  d={`M ${segment.end[0]} ${segment.end[1]} A ${opening.width} ${opening.width} 0 ${largeArcFlag} 0 ${doorEnd[0]} ${doorEnd[1]}`}
                  fill="none"
                  stroke="#4fb5c8"
                  strokeDasharray="0.35 0.25"
                  strokeWidth="0.12"
                />
              </>
            ) : (
              <g transform={`rotate(${(angle * 180) / Math.PI} ${opening.center[0]} ${opening.center[1]})`}>
                <line
                  x1={opening.center[0] - opening.width / 2}
                  y1={opening.center[1] - 0.12}
                  x2={opening.center[0] + opening.width / 2}
                  y2={opening.center[1] - 0.12}
                  stroke="#84cc16"
                  strokeWidth="0.11"
                />
                <line
                  x1={opening.center[0] - opening.width / 2}
                  y1={opening.center[1] + 0.12}
                  x2={opening.center[0] + opening.width / 2}
                  y2={opening.center[1] + 0.12}
                  stroke="#84cc16"
                  strokeWidth="0.11"
                />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
