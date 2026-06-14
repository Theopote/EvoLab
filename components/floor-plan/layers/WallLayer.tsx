import type { Wall } from "@/lib/project-types";

interface WallLayerProps {
  walls: Wall[];
  selectedWallId?: string;
  onSelectWall?: (wallId: string) => void;
}

export function WallLayer({ walls, selectedWallId, onSelectWall }: WallLayerProps) {
  return (
    <g data-layer="walls">
      {walls.map((wall) => {
        const selected = wall.id === selectedWallId;

        return (
          <line
            key={wall.id}
            x1={wall.start[0]}
            y1={wall.start[1]}
            x2={wall.end[0]}
            y2={wall.end[1]}
            stroke={selected ? "#e2e8f0" : wall.type === "external" ? "#e5f6ff" : wall.type === "core" ? "#f0b35b" : "#7d8fa3"}
            strokeLinecap="square"
            strokeWidth={Math.max(0.18, wall.thickness)}
            className={onSelectWall ? "cursor-pointer" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelectWall?.(wall.id);
            }}
          />
        );
      })}
    </g>
  );
}
